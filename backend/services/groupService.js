import { prisma } from '../lib/prisma.js';

const GROUP_SIZE = 5;

/**
 * Fill existing groups with fewer than 5 farmers before creating a new group.
 */
export async function assignFarmerToGroup(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.groupId) return user?.groupId ?? null;

  const groups = await prisma.group.findMany({
    include: {
      _count: { select: { users: true } },
    },
    orderBy: { name: 'asc' },
  });

  for (const g of groups) {
    if (g._count.users < GROUP_SIZE) {
      await prisma.user.update({
        where: { id: userId },
        data: { groupId: g.id },
      });
      return g.id;
    }
  }

  const n = groups.length + 1;
  const created = await prisma.group.create({
    data: { name: `Group ${n}` },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { groupId: created.id },
  });
  return created.id;
}
