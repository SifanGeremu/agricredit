import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  loanStatusFromCreditScore,
  rejectionReasonForLowScore,
} from '../services/creditService.js';
import { assignFarmerToGroup } from '../services/groupService.js';
import { hasBlockingLoan, addMonths } from '../services/loanRules.js';
import { LoanStatus } from '../lib/db.js';
import { notifyUser } from '../services/notifications.js';

async function isFarmerBlocked(vendorId, farmerUserId) {
  const row = await prisma.vendorFarmerBlock.findFirst({
    where: { vendorId, farmerId: farmerUserId },
  });
  return !!row;
}

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

    let amount = req.body.amount != null ? Number(req.body.amount) : null;
    let purpose = req.body.purpose != null ? String(req.body.purpose).trim() : '';
    const vendorId = req.body.vendorId != null ? String(req.body.vendorId).trim() : null;
    const productId = req.body.productId != null ? String(req.body.productId).trim() : null;

    let productName = null;
    let linkedProductId = null;

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { vendor: true },
      });
      if (!product) throw new AppError('Product not found', 404);
      if (vendorId && product.vendorId !== vendorId) {
        throw new AppError('Product does not belong to the selected vendor', 400);
      }
      productName = product.name;
      linkedProductId = product.id;
      purpose = purpose || product.name;
      if (amount == null || !Number.isFinite(amount)) {
        amount = product.price;
      }
    }

    if (!purpose) {
      throw new AppError('Purpose or product is required', 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    if (vendorId && (await isFarmerBlocked(vendorId, userId))) {
      throw new AppError(
        'This vendor has blocked new credit orders from your account. Choose another vendor or contact support.',
        403,
      );
    }

    if (vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: vendorId, isVerified: true },
      });
      if (!vendor) {
        throw new AppError('Vendor not found or not verified', 404);
      }
    }

    const data = {
      userId,
      amount,
      purpose,
      status,
      reason: status === LoanStatus.rejected ? reason : null,
      productId: linkedProductId,
      productName,
      vendorId: vendorId || null,
    };

    if (status === LoanStatus.approved) {
      data.dueDate = addMonths(new Date(), 3);
    }

    const loan = await prisma.loan.create({ data });

    if (vendorId) {
      const v = await prisma.vendor.findUnique({ where: { id: vendorId } });
      if (v?.userId) {
        await notifyUser(
          v.userId,
          'New order',
          `${me.name} placed an order: ${productName || purpose} (₦${amount.toLocaleString()}). Awaiting admin approval.`,
          'info',
        );
      }
    }

    res.status(201).json({
      success: true,
      message:
        status === LoanStatus.rejected
          ? 'Loan request declined based on credit score.'
          : status === LoanStatus.approved
            ? 'Loan pre-approved. Admin will disburse funds to the vendor when ready.'
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
    if (await isFarmerBlocked(vendorId, userId)) {
      throw new AppError(
        'This vendor has blocked new credit orders from your account.',
        403,
      );
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
