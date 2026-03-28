/**
 * Seed demo data: admin, farmers, vendors, groups, loans (mixed statuses).
 * Run: npm run seed  (after npx prisma db push)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Role,
  LoanStatus,
  RepaymentStatus,
  UserAccountStatus,
} from '../lib/db.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Demo123!', 12);

  await prisma.notification.deleteMany();
  await prisma.vendorFarmerBlock.deleteMany();
  await prisma.repayment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();

  const g1 = await prisma.group.create({ data: { name: 'Group 1' } });
  const g2 = await prisma.group.create({ data: { name: 'Group 2' } });

  const admin = await prisma.user.create({
    data: {
      name: 'AgriCredit Admin',
      phone: '254700000001',
      nationalId: '100000000001',
      password: passwordHash,
      role: Role.admin,
      accountStatus: UserAccountStatus.active,
      groupId: null,
      creditScore: 100,
    },
  });

  const farmerLow = await prisma.user.create({
    data: {
      name: 'Farmer Low Score',
      phone: '254700000010',
      nationalId: '200000000010',
      password: passwordHash,
      role: Role.user,
      accountStatus: UserAccountStatus.active,
      groupId: g1.id,
      creditScore: 45,
    },
  });

  const farmerMid = await prisma.user.create({
    data: {
      name: 'Farmer Mid Score',
      phone: '254700000011',
      nationalId: '200000000011',
      password: passwordHash,
      role: Role.user,
      accountStatus: UserAccountStatus.active,
      groupId: g1.id,
      creditScore: 60,
    },
  });

  const farmerHigh = await prisma.user.create({
    data: {
      name: 'Farmer High Score',
      phone: '254700000012',
      nationalId: '200000000012',
      password: passwordHash,
      role: Role.user,
      accountStatus: UserAccountStatus.active,
      groupId: g1.id,
      creditScore: 75,
    },
  });

  const farmerDelivered = await prisma.user.create({
    data: {
      name: 'Farmer Ready Repay',
      phone: '254700000013',
      nationalId: '200000000013',
      password: passwordHash,
      role: Role.user,
      accountStatus: UserAccountStatus.active,
      groupId: g2.id,
      creditScore: 72,
    },
  });

  const farmerRepaid = await prisma.user.create({
    data: {
      name: 'Farmer Repaid',
      phone: '254700000014',
      nationalId: '200000000014',
      password: passwordHash,
      role: Role.user,
      accountStatus: UserAccountStatus.active,
      groupId: g2.id,
      creditScore: 70,
    },
  });

  const vUser1 = await prisma.user.create({
    data: {
      name: 'Vendor One Agro',
      phone: '254710000001',
      nationalId: '300000000001',
      password: passwordHash,
      role: Role.vendor,
      accountStatus: UserAccountStatus.active,
    },
  });

  const vendor1 = await prisma.vendor.create({
    data: {
      userId: vUser1.id,
      name: 'Vendor One Agro',
      phone: '254710000001',
      walletNumber: '254710000001',
      isVerified: true,
    },
  });

  const vUser2 = await prisma.user.create({
    data: {
      name: 'Vendor Two Seeds',
      phone: '254710000002',
      nationalId: '300000000002',
      password: passwordHash,
      role: Role.vendor,
      accountStatus: UserAccountStatus.active,
    },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      userId: vUser2.id,
      name: 'Vendor Two Seeds',
      phone: '254710000002',
      walletNumber: '254710000002',
      isVerified: true,
    },
  });

  await prisma.product.createMany({
    data: [
      {
        vendorId: vendor1.id,
        name: 'Maize Seeds',
        category: 'Seeds',
        price: 5000,
        stock: 100,
      },
      {
        vendorId: vendor1.id,
        name: 'NPK Fertilizer',
        category: 'Fertilizers',
        price: 12000,
        stock: 50,
      },
      {
        vendorId: vendor2.id,
        name: 'Coffee Seedlings',
        category: 'Seeds',
        price: 8000,
        stock: 40,
      },
    ],
  });

  const due = new Date();
  due.setMonth(due.getMonth() + 3);

  await prisma.loan.create({
    data: {
      userId: farmerLow.id,
      amount: 5000,
      purpose: 'Fertilizer',
      status: LoanStatus.rejected,
      reason: 'Credit score below minimum threshold (50).',
    },
  });

  await prisma.loan.create({
    data: {
      userId: farmerMid.id,
      amount: 8000,
      purpose: 'Seeds',
      status: LoanStatus.pending,
    },
  });

  await prisma.loan.create({
    data: {
      userId: farmerHigh.id,
      amount: 12000,
      purpose: 'Equipment',
      status: LoanStatus.approved,
      dueDate: due,
      vendorId: vendor1.id,
    },
  });

  await prisma.loan.create({
    data: {
      userId: farmerDelivered.id,
      amount: 15000,
      purpose: 'Inputs bundle',
      status: LoanStatus.delivered,
      dueDate: due,
      vendorId: vendor2.id,
    },
  });

  const repaidLoan = await prisma.loan.create({
    data: {
      userId: farmerRepaid.id,
      amount: 6000,
      purpose: 'Harvest loan',
      status: LoanStatus.repaid,
      dueDate: due,
      vendorId: vendor1.id,
    },
  });

  await prisma.repayment.create({
    data: {
      loanId: repaidLoan.id,
      amount: 6000,
      status: RepaymentStatus.success,
      transactionRef: 'SEED_REPAY_1',
    },
  });

  console.log('Seed complete.');
  console.log('Admin login: 254700000001 / Demo123!');
  console.log('Farmers: 254700000010–014 / Demo123!');
  console.log('Vendors: 254710000001–002 / Demo123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
