import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

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
