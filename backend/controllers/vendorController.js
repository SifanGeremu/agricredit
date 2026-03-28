import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { LoanStatus, Role } from '../lib/db.js';
import { notifyUser } from '../services/notifications.js';

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
    const repayBy = new Date();
    repayBy.setDate(repayBy.getDate() + 14);
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: { status: LoanStatus.delivered, repayBy },
    });
    await notifyUser(
      loan.userId,
      'Order delivered',
      `${loan.productName || loan.purpose} was delivered. Please repay ₦${loan.amount.toLocaleString()} when ready (due ${repayBy.toLocaleDateString()}).`,
      'warning',
    );
    res.json({
      success: true,
      message: 'Delivery confirmed. Farmer can now repay.',
      data: { loan: updated },
    });
  } catch (e) {
    next(e);
  }
}

export async function listBlockedFarmers(req, res, next) {
  try {
    const vendor = requireVendorProfile(req);
    const blocks = await prisma.vendorFarmerBlock.findMany({
      where: { vendorId: vendor.id },
    });
    res.json({ success: true, data: { farmerIds: blocks.map((b) => b.farmerId) } });
  } catch (e) {
    next(e);
  }
}

export async function blockFarmer(req, res, next) {
  try {
    const vendor = requireVendorProfile(req);
    const { farmerId } = req.body;
    if (!farmerId) throw new AppError('farmerId is required', 400);
    const farmer = await prisma.user.findFirst({
      where: { id: farmerId, role: Role.user },
    });
    if (!farmer) throw new AppError('Farmer not found', 404);
    await prisma.vendorFarmerBlock.upsert({
      where: {
        vendorId_farmerId: { vendorId: vendor.id, farmerId },
      },
      create: { vendorId: vendor.id, farmerId },
      update: {},
    });
    res.json({ success: true, message: 'Farmer blocked' });
  } catch (e) {
    next(e);
  }
}

export async function unblockFarmer(req, res, next) {
  try {
    const vendor = requireVendorProfile(req);
    const { farmerId } = req.params;
    await prisma.vendorFarmerBlock.deleteMany({
      where: { vendorId: vendor.id, farmerId },
    });
    res.json({ success: true, message: 'Farmer unblocked' });
  } catch (e) {
    next(e);
  }
}

/** Farmers who have (or had) loans with this vendor — for vendor dashboard lists */
export async function listRelatedFarmers(req, res, next) {
  try {
    const vendor = requireVendorProfile(req);
    const loans = await prisma.loan.findMany({
      where: { vendorId: vendor.id },
      select: { userId: true },
    });
    const ids = [...new Set(loans.map((l) => l.userId))];
    const farmers = await prisma.user.findMany({
      where: { id: { in: ids }, role: Role.user },
      select: {
        id: true,
        name: true,
        phone: true,
        nationalId: true,
        creditScore: true,
        location: true,
        farmSize: true,
        cropType: true,
        accountStatus: true,
        groupId: true,
      },
    });
    res.json({ success: true, data: { farmers } });
  } catch (e) {
    next(e);
  }
}
