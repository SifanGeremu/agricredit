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
        phone: true,
        isVerified: true,
      },
    });
    res.json({ success: true, data: { vendors } });
  } catch (e) {
    next(e);
  }
}
