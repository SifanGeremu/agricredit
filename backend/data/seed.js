/**
 * Minimal demo seed: admin + vendor + farmer (delivered loan → M-Pesa STK).
 * Run: npm run seed
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Role,
  LoanStatus,
  UserAccountStatus,
} from '../lib/db.js';

const prisma = new PrismaClient();

/** One password for every demo account (easy to type). */
const PASSWORD = 'demo1234';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.notification.deleteMany();
  await prisma.vendorFarmerBlock.deleteMany();
  await prisma.repayment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();

  const group = await prisma.group.create({ data: { name: 'Demo Group' } });

  await prisma.user.create({
    data: {
      name: 'Admin',
      phone: '1111111111',
      nationalId: '111111111111',
      password: passwordHash,
      role: Role.admin,
      accountStatus: UserAccountStatus.active,
      groupId: null,
      creditScore: 100,
    },
  });

  const vendorUser = await prisma.user.create({
    data: {
      name: 'Demo Vendor',
      phone: '2222222222',
      nationalId: '222222222222',
      password: passwordHash,
      role: Role.vendor,
      accountStatus: UserAccountStatus.active,
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      userId: vendorUser.id,
      name: 'Demo Vendor',
      phone: '2222222222',
      walletNumber: '2222222222',
      isVerified: true,
    },
  });

  await prisma.product.create({
    data: {
      vendorId: vendor.id,
      name: 'Demo Seeds',
      category: 'Seeds',
      price: 5000,
      stock: 99,
    },
  });

  const farmer = await prisma.user.create({
    data: {
      name: 'Demo Farmer',
      phone: '3333333333',
      nationalId: '333333333333',
      password: passwordHash,
      role: Role.user,
      accountStatus: UserAccountStatus.active,
      groupId: group.id,
      creditScore: 75,
    },
  });

  const due = new Date();
  due.setMonth(due.getMonth() + 3);

  await prisma.loan.create({
    data: {
      userId: farmer.id,
      amount: 15000,
      purpose: 'STK repayment demo',
      status: LoanStatus.delivered,
      dueDate: due,
      vendorId: vendor.id,
      productName: 'Demo Seeds',
    },
  });

  console.log('');
  console.log('========== DEMO LOGIN (same password for all) ==========');
  console.log(`Password: ${PASSWORD}`);
  console.log('');
  console.log('ADMIN   phone 1111111111   → dashboard / loans');
  console.log('VENDOR  phone 2222222222   → orders (confirm delivery if needed)');
  console.log('FARMER  phone 3333333333   → opens M-Pesa repayment (STK) — loan is Delivered');
  console.log('========================================================');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
