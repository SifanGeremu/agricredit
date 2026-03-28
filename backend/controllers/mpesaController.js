import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { receiveRepayment, logTransaction } from '../services/mpesaService.js';
import { increaseCreditAfterRepayment } from '../services/creditService.js';
import { smsLoanRepaid } from '../services/smsSimulator.js';
import {
  LoanStatus,
  RepaymentStatus,
  TransactionType,
  TransactionStatus,
} from '../lib/db.js';

/** When true (default): STK HTTP success only starts the prompt — loan is settled on callback, not immediately. */
function deferRepaymentUntilCallback() {
  return process.env.MPESA_RECORD_REPAYMENT_ON_CALLBACK_ONLY !== 'false';
}

function genTxnRef() {
  return `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Walk callback JSON (Ethiopia / Daraja shapes) for ResultCode 0 and AccountReference. */
function parseStkCallbackPayload(body) {
  let resultOk = false;
  const codes = [];
  let accountRef = null;

  function walk(obj, depth) {
    if (obj == null || depth > 25) return;
    if (typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const x of obj) walk(x, depth + 1);
      return;
    }

    const rc = obj.ResultCode ?? obj.resultCode;
    if (rc !== undefined && rc !== null) codes.push(rc);

    const ar = obj.AccountReference ?? obj.accountReference;
    if (ar != null && String(ar).length > 0) accountRef = String(ar);

    if (Array.isArray(obj.Item)) {
      for (const it of obj.Item) {
        if (!it || typeof it !== 'object') continue;
        const n = it.Name ?? it.name;
        const v = it.Value ?? it.value;
        if (n === 'AccountReference' && v != null) accountRef = String(v);
      }
    }

    for (const v of Object.values(obj)) walk(v, depth + 1);
  }

  walk(body, 0);

  resultOk = codes.some((c) => c === 0 || c === '0');
  return { resultOk, accountRef };
}

/**
 * Finalize a pending repayment after Safaricom STK callback (or dev confirm).
 * accountRef must match Repayment.transactionRef (12-char hex sent as AccountReference).
 */
export async function finalizePendingRepayment(accountRef) {
  if (!accountRef || typeof accountRef !== 'string') {
    return { ok: false, reason: 'missing_account_ref' };
  }

  const pending = await prisma.repayment.findFirst({
    where: { transactionRef: accountRef.trim(), status: RepaymentStatus.pending },
    include: { loan: true },
  });
  if (!pending) {
    return { ok: false, reason: 'pending_not_found' };
  }

  const user = await prisma.user.findUnique({ where: { id: pending.loan.userId } });
  const phone = user?.phone || '';

  await prisma.repayment.update({
    where: { id: pending.id },
    data: { status: RepaymentStatus.success },
  });

  await logTransaction({
    type: TransactionType.repay,
    phone,
    amount: pending.amount,
    status: TransactionStatus.success,
    reference: genTxnRef(),
  });

  const loan = await prisma.loan.findUnique({
    where: { id: pending.loanId },
    include: {
      repayments: { where: { status: RepaymentStatus.success } },
    },
  });
  if (!loan) {
    return { ok: true, repayment: pending, loan: null, user };
  }

  const paidSoFar = loan.repayments.reduce((s, r) => s + r.amount, 0);
  let loanUpdated = loan;
  if (paidSoFar >= loan.amount && loan.status !== LoanStatus.repaid) {
    loanUpdated = await prisma.loan.update({
      where: { id: loan.id },
      data: { status: LoanStatus.repaid },
    });
    await increaseCreditAfterRepayment(prisma, loan.userId, 20);
    if (user?.phone) smsLoanRepaid(user.phone, loan.amount);
  }

  return { ok: true, repayment: pending, loan: loanUpdated, user };
}

export async function repayLoan(req, res, next) {
  try {
    const userId = req.user.id;
    const loanId = req.body.loanId;
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Invalid repayment amount', 400);
    }

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
      include: { repayments: true },
    });
    if (!loan) {
      throw new AppError('Loan not found or not yours', 404);
    }
    if (loan.status !== LoanStatus.delivered) {
      throw new AppError('Repayment is only allowed after inputs are delivered', 400);
    }

    const hasPending = loan.repayments.some(
      (r) => r.status === RepaymentStatus.pending,
    );
    if (hasPending) {
      throw new AppError(
        'A repayment is waiting for M-Pesa confirmation (callback). Wait for it to complete or use dev confirm in sandbox.',
        400,
      );
    }

    const paidSoFar = loan.repayments
      .filter((r) => r.status === RepaymentStatus.success)
      .reduce((s, r) => s + r.amount, 0);
    const remaining = loan.amount - paidSoFar;
    if (remaining <= 0) {
      throw new AppError('Loan is already fully repaid', 400);
    }
    if (amount > remaining) {
      throw new AppError(`Amount exceeds remaining balance (${remaining})`, 400);
    }

    const phone = req.user.phone;
    const mpesa = await receiveRepayment(phone, amount);
    if (!mpesa.ok) {
      throw new AppError(
        mpesa.message || 'M-Pesa STK failed — repayment not recorded.',
        502,
      );
    }

    const defer =
      deferRepaymentUntilCallback() && mpesa.stkInitiated && !mpesa.simulated;

    const mpesaSummary =
      mpesa.stkInitiated && mpesa.checkoutRequestId
        ? `M-Pesa STK accepted (prompt sent). ${mpesa.customerMessage || ''} CheckoutRequestID: ${mpesa.checkoutRequestId}. Ref: ${mpesa.reference}.`
        : `${mpesa.message} Ref: ${mpesa.reference}.`;

    if (defer) {
      const repayment = await prisma.repayment.create({
        data: {
          loanId: loan.id,
          amount,
          status: RepaymentStatus.pending,
          transactionRef: mpesa.stkAccountRef,
        },
      });

      return res.json({
        success: true,
        message: `STK sent to your phone. Loan stays open until Safaricom confirms payment on your CallBackURL. ${mpesaSummary}`,
        data: {
          repayment,
          mpesa: {
            ...mpesa,
            displayHint:
              'Complete the prompt on your handset. The loan balance updates when the STK callback confirms payment (POST /mpesa/webhook/stk). For local testing use POST /mpesa/dev/confirm-stk with { "transactionRef": "<stkAccountRef>" }.',
          },
          loan,
        },
      });
    }

    const repayment = await prisma.repayment.create({
      data: {
        loanId: loan.id,
        amount,
        status: RepaymentStatus.success,
        transactionRef: mpesa.stkAccountRef,
      },
    });

    await logTransaction({
      type: TransactionType.repay,
      phone,
      amount,
      status: TransactionStatus.success,
      reference: mpesa.reference,
    });

    const newTotal = paidSoFar + amount;
    let loanUpdated = loan;
    if (newTotal >= loan.amount) {
      loanUpdated = await prisma.loan.update({
        where: { id: loan.id },
        data: { status: LoanStatus.repaid },
      });
      await increaseCreditAfterRepayment(prisma, userId, 20);
      smsLoanRepaid(phone, loan.amount);
    }

    const loanDone = newTotal >= loan.amount;
    res.json({
      success: true,
      message: loanDone
        ? `Loan fully repaid. Credit score +20. ${mpesaSummary}`
        : `Partial repayment recorded. ${mpesaSummary}`,
      data: {
        repayment,
        mpesa: {
          ...mpesa,
          displayHint: mpesa.stkInitiated
            ? 'Check your phone for the M-Pesa prompt. Final status also arrives at your CallBackURL.'
            : mpesa.simulated
              ? 'Demo fallback: STK did not confirm from Safaricom; repayment was still saved because MPESA_ALLOW_SIMULATED_FALLBACK=true.'
              : mpesa.message,
        },
        loan: loanUpdated,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Safaricom STK callback — no JWT (configure this URL in the portal / webhook.site). */
export async function stkWebhook(req, res, next) {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== 'object') body = {};
    const { resultOk, accountRef } = parseStkCallbackPayload(body);

    if (!resultOk || !accountRef) {
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Acknowledged',
        note: 'No success ResultCode or AccountReference in payload',
      });
    }

    const out = await finalizePendingRepayment(accountRef);
    if (!out.ok) {
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Acknowledged',
        note: out.reason || 'not_finalized',
      });
    }

    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Repayment finalized',
    });
  } catch (e) {
    next(e);
  }
}

/** Dev-only: confirm pending repayment as if callback arrived (use stkAccountRef from /mpesa/repay response). */
export async function devConfirmStk(req, res, next) {
  try {
    const secret = process.env.DEV_STK_CONFIRM_SECRET;
    if (process.env.NODE_ENV === 'production') {
      if (!secret) throw new AppError('Not available in production', 404);
      if (req.headers['x-dev-stk-secret'] !== secret) throw new AppError('Forbidden', 403);
    } else if (secret && req.headers['x-dev-stk-secret'] !== secret) {
      throw new AppError('Forbidden', 403);
    }

    const ref = String(req.body?.transactionRef || '').trim();
    if (!ref) throw new AppError('transactionRef required', 400);

    const out = await finalizePendingRepayment(ref);
    if (!out.ok) {
      throw new AppError(`Could not finalize: ${out.reason}`, 400);
    }

    res.json({
      success: true,
      message: 'Pending repayment marked successful (dev / manual confirm).',
      data: { loan: out.loan },
    });
  } catch (e) {
    next(e);
  }
}
