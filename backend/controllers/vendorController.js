import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { LoanStatus } from '../lib/db.js';

function requireVendorProfile(req) {
  const vendor = req.user.vendor;
  if (!vendor) {
    throw new AppError('Vendor profile not linked to this account', 403);
  }
  return vendor;
}

export async function getVendorLoans(req, res, next) {
  try {
    const vendor = requireVendorProfile(req);
    const loans = await prisma.loan.findMany({
      where: { vendorId: vendor.id },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        repayments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { loans } });
  } catch (e) {
    next(e);
  }
}

export async function confirmDelivery(req, res, next) {
  try {
    const vendor = requireVendorProfile(req);
    const { id } = req.params;
    const loan = await prisma.loan.findFirst({
      where: { id, vendorId: vendor.id },
    });
    if (!loan) {
      throw new AppError('Loan not found or not assigned to you', 404);
    }
    if (loan.status !== LoanStatus.disbursed) {
      throw new AppError('Delivery can only be confirmed after funds are disbursed', 400);
    }
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: { status: LoanStatus.delivered },
    });
    res.json({
      success: true,
      message: 'Delivery confirmed. Farmer can now repay.',
      data: { loan: updated },
    });
  } catch (e) {
    next(e);
  }
}
