import { prisma } from '../lib/prisma.js';

export async function notifyUser(userId, title, message, type = 'info') {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type },
    });
  } catch (e) {
    console.warn('notifyUser failed', e.message);
  }
}
