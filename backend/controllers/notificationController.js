import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export async function listNotifications(req, res, next) {
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: { notifications: rows } });
  } catch (e) {
    next(e);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });
    res.json({ success: true, message: 'All notifications marked read' });
  } catch (e) {
    next(e);
  }
}
