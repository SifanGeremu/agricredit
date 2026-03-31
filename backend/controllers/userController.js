import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { LoanStatus } from '../lib/db.js';

export async function getMyLoans(req, res, next) {
  try {
    const loans = await prisma.loan.findMany({
      where: { userId: req.user.id },
      include: { vendor: true, repayments: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { loans } });
  } catch (e) {
    next(e);
  }
}

export async function listVendors(req, res, next) {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { isVerified: true },
      select: {
        id: true,
        name: true,
        ownerName: true,
        phone: true,
        location: true,
        isVerified: true,
      },
    });
    const mapped = vendors.map((v) => ({
      ...v,
      businessName: v.name,
      status: 'active',
    }));
    res.json({ success: true, data: { vendors: mapped } });
  } catch (e) {
    next(e);
  }
}

export async function listBlockedVendorIds(req, res, next) {
  try {
    const rows = await prisma.vendorFarmerBlock.findMany({
      where: { farmerId: req.user.id },
      select: { vendorId: true },
    });
    res.json({
      success: true,
      data: { vendorIds: rows.map((r) => r.vendorId) },
    });
  } catch (e) {
    next(e);
  }
}

export async function listCatalogProducts(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      where: { vendor: { isVerified: true } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { products } });
  } catch (e) {
    next(e);
  }
}

/**
 * Farmer-side delivery acknowledgment: once vendor has been paid (disbursed),
 * the farmer can confirm they received the goods, which unlocks repayment.
 */
export async function confirmReceived(req, res, next) {
  try {
    const { id } = req.params;
    const loan = await prisma.loan.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!loan) throw new AppError('Loan not found or not yours', 404);
    if (loan.status !== LoanStatus.disbursed) {
      throw new AppError('Can only confirm receipt after vendor is paid', 400);
    }
    const repayBy = new Date();
    repayBy.setDate(repayBy.getDate() + 14);
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: { status: LoanStatus.delivered, repayBy },
    });
    res.json({
      success: true,
      message: 'Receipt confirmed. You can repay now.',
      data: { loan: updated },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Dev helper: create a Delivered loan for the current farmer so the Repay UI becomes usable.
 * This avoids needing the full admin→vendor→delivery pipeline in demos.
 */
export async function devCreateRepayDemoLoan(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Not available in production', 404);
    }

    const amount = 15000;
    const purpose = 'STK repayment demo';
    const due = new Date();
    due.setMonth(due.getMonth() + 3);

    const loan = await prisma.loan.create({
      data: {
        userId: req.user.id,
        amount,
        purpose,
        status: LoanStatus.delivered,
        dueDate: due,
        productName: 'Demo Seeds',
      },
    });

    res.json({
      success: true,
      message: 'Demo delivered loan created. You can repay now.',
      data: { loan },
    });
  } catch (e) {
    next(e);
  }
}

export async function getMyGroup(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        group: { include: { users: { select: { id: true, name: true } } } },
      },
    });
    if (!user?.group) {
      res.json({ success: true, data: { group: null } });
      return;
    }
    const g = user.group;
    res.json({
      success: true,
      data: {
        group: {
          id: g.id,
          name: g.name,
          memberIds: g.users.map((u) => u.id),
          repaymentRate: 100,
        },
      },
    });
  } catch (e) {
    next(e);
  }
}
