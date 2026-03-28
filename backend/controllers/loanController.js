import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  loanStatusFromCreditScore,
  rejectionReasonForLowScore,
} from '../services/creditService.js';
import { assignFarmerToGroup } from '../services/groupService.js';
import { hasBlockingLoan, addMonths } from '../services/loanRules.js';
import { LoanStatus } from '../lib/db.js';

export async function requestLoan(req, res, next) {
  try {
    const userId = req.user.id;
    if (await hasBlockingLoan(prisma, userId)) {
      throw new AppError(
        'You already have an active loan (pending, approved, disbursed, or awaiting repayment).',
        400,
      );
    }
    await assignFarmerToGroup(userId);
    const me = await prisma.user.findUnique({ where: { id: userId } });
    const score = me.creditScore;
    const status = loanStatusFromCreditScore(score);
    const reason = rejectionReasonForLowScore(score);
    const amount = Number(req.body.amount);
    const purpose = String(req.body.purpose).trim();

    const data = {
      userId,
      amount,
      purpose,
      status,
      reason: status === LoanStatus.rejected ? reason : null,
    };
    if (status === LoanStatus.approved) {
      data.dueDate = addMonths(new Date(), 3);
    }

    const loan = await prisma.loan.create({ data });
    res.status(201).json({
      success: true,
      message:
        status === LoanStatus.rejected
          ? 'Loan request declined based on credit score.'
          : status === LoanStatus.approved
            ? 'Loan pre-approved. Select a vendor, then wait for disbursement.'
            : 'Loan submitted and pending admin review.',
      data: { loan },
    });
  } catch (e) {
    next(e);
  }
}

export async function selectVendor(req, res, next) {
  try {
    const userId = req.user.id;
    const { loanId, vendorId } = req.body;
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId },
    });
    if (!loan) {
      throw new AppError('Loan not found or not yours', 404);
    }
    if (loan.status !== LoanStatus.approved) {
      throw new AppError('Loan must be approved before selecting a vendor', 400);
    }
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, isVerified: true },
    });
    if (!vendor) {
      throw new AppError('Vendor not found or not verified', 404);
    }
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: { vendorId: vendor.id },
    });
    res.json({
      success: true,
      message: 'Vendor selected. Admin can now disburse funds to the vendor.',
      data: { loan: updated },
    });
  } catch (e) {
    next(e);
  }
}
