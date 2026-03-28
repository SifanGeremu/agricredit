import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { receiveRepayment } from '../services/mpesaService.js';
import { increaseCreditAfterRepayment } from '../services/creditService.js';
import { smsLoanRepaid } from '../services/smsSimulator.js';
import { LoanStatus, RepaymentStatus } from '../lib/db.js';

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
      include: {
        repayments: { where: { status: RepaymentStatus.success } },
      },
    });
    if (!loan) {
      throw new AppError('Loan not found or not yours', 404);
    }
    if (loan.status !== LoanStatus.delivered) {
      throw new AppError('Repayment is only allowed after inputs are delivered', 400);
    }

    const paidSoFar = loan.repayments.reduce((s, r) => s + r.amount, 0);
    const remaining = loan.amount - paidSoFar;
    if (remaining <= 0) {
      throw new AppError('Loan is already fully repaid', 400);
    }
    if (amount > remaining) {
      throw new AppError(`Amount exceeds remaining balance (${remaining})`, 400);
    }

    const phone = req.user.phone;
    const mpesa = await receiveRepayment(phone, amount);

    const repayment = await prisma.repayment.create({
      data: {
        loanId: loan.id,
        amount,
        status: RepaymentStatus.success,
        transactionRef: mpesa.reference,
      },
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

    res.json({
      success: true,
      message:
        newTotal >= loan.amount
          ? 'Loan fully repaid. Credit score increased by 20.'
          : 'Partial repayment recorded.',
      data: { repayment, mpesa, loan: loanUpdated },
    });
  } catch (e) {
    next(e);
  }
}
