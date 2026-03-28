import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { disburseToVendor } from '../services/mpesaService.js';
import { addMonths } from '../services/loanRules.js';
import { smsLoanApproved, smsLoanDisbursed } from '../services/smsSimulator.js';
import { LoanStatus, Role, UserAccountStatus } from '../lib/db.js';
import { notifyUser } from '../services/notifications.js';

export async function listLoans(req, res, next) {
  try {
    const loans = await prisma.loan.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true, creditScore: true } },
        vendor: true,
        repayments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { loans } });
  } catch (e) {
    next(e);
  }
}

export async function approveLoan(req, res, next) {
  try {
    const { id } = req.params;
    const loan = await prisma.loan.findUnique({ where: { id }, include: { user: true } });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.status === LoanStatus.rejected) {
      throw new AppError('Cannot approve a rejected loan', 400);
    }
    if (loan.status !== LoanStatus.pending && loan.status !== LoanStatus.approved) {
      throw new AppError('Loan is not awaiting approval', 400);
    }
    if (loan.status === LoanStatus.approved) {
      res.json({
        success: true,
        message: 'Loan was already approved',
        data: { loan },
      });
      return;
    }
    const dueDate = addMonths(new Date(), 3);
    const updated = await prisma.loan.update({
      where: { id },
      data: { status: LoanStatus.approved, dueDate, reason: null },
    });
    smsLoanApproved(loan.user.phone, loan.amount);
    await notifyUser(
      loan.userId,
      'Loan approved',
      `Your credit for ${loan.purpose} (₦${loan.amount.toLocaleString()}) was approved. ${loan.vendorId ? 'Awaiting disbursement to vendor.' : 'Select a vendor in the app.'}`,
      'success',
    );
    res.json({
      success: true,
      message: 'Loan approved; due date set to 3 months from today.',
      data: { loan: updated },
    });
  } catch (e) {
    next(e);
  }
}

export async function rejectLoan(req, res, next) {
  try {
    const { id } = req.params;
    const reason = String(req.body.reason || '').trim() || 'Rejected by admin';
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new AppError('Loan not found', 404);
    const terminal = [LoanStatus.disbursed, LoanStatus.delivered, LoanStatus.repaid];
    if (terminal.includes(loan.status)) {
      throw new AppError('Cannot reject loan at this stage', 400);
    }
    const updated = await prisma.loan.update({
      where: { id },
      data: { status: LoanStatus.rejected, reason },
    });
    await notifyUser(
      loan.userId,
      'Loan not approved',
      `Your request for ${loan.productName || loan.purpose} (₦${loan.amount.toLocaleString()}) was rejected. ${reason}`,
      'error',
    );
    res.json({ success: true, message: 'Loan rejected', data: { loan: updated } });
  } catch (e) {
    next(e);
  }
}

export async function disburseLoan(req, res, next) {
  try {
    const { id } = req.params;
    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { vendor: true, user: true },
    });
    if (!loan) throw new AppError('Loan not found', 404);
    if (loan.status !== LoanStatus.approved) {
      throw new AppError('Loan must be approved before disbursement', 400);
    }
    if (!loan.vendorId || !loan.vendor) {
      throw new AppError('Farmer must select a vendor first', 400);
    }
    const phone = loan.vendor.walletNumber || loan.vendor.phone;
    const mpesa = await disburseToVendor(phone, loan.amount);
    const updated = await prisma.loan.update({
      where: { id },
      data: { status: LoanStatus.disbursed },
    });
    smsLoanDisbursed(loan.vendor.phone, loan.amount, loan.user.name);
    await notifyUser(
      loan.vendor.userId,
      'Payment received',
      `₦${loan.amount.toLocaleString()} for ${loan.productName || loan.purpose} was sent to your account. Confirm delivery when the farmer receives the goods.`,
      'success',
    );
    await notifyUser(
      loan.userId,
      'Payment sent to vendor',
      `Your credit for ${loan.productName || loan.purpose} (₦${loan.amount.toLocaleString()}) was sent to the vendor. You will be notified when inputs are delivered.`,
      'success',
    );
    res.json({
      success: true,
      message: 'Funds disbursed to vendor (per policy).',
      data: { loan: updated, mpesa },
    });
  } catch (e) {
    next(e);
  }
}

async function generateUniqueVendorNationalId() {
  for (let i = 0; i < 20; i += 1) {
    const nationalId = String(Math.floor(100000000000 + Math.random() * 899999999999));
    const taken = await prisma.user.findUnique({ where: { nationalId } });
    if (!taken) return nationalId;
  }
  throw new AppError('Could not allocate a unique National ID for vendor', 500);
}

export async function createVendor(req, res, next) {
  try {
    const { name, phone, walletNumber, password } = req.body;
    const normalizedPhone = String(phone).trim();
    const exists = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (exists) {
      throw new AppError('Phone already in use', 409);
    }
    const hash = await bcrypt.hash(password, 12);
    const nationalId = await generateUniqueVendorNationalId();
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        nationalId,
        password: hash,
        role: Role.vendor,
        accountStatus: UserAccountStatus.active,
      },
    });
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        name: name.trim(),
        phone: normalizedPhone,
        walletNumber: String(walletNumber).trim(),
        isVerified: true,
      },
    });
    const { password: _, ...safeUser } = user;
    res.status(201).json({
      success: true,
      message: 'Vendor account created',
      data: { vendor, user: safeUser },
    });
  } catch (e) {
    next(e);
  }
}

export async function listAdminVendors(req, res, next) {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        user: { select: { id: true, phone: true, name: true, accountStatus: true } },
      },
    });
    const mapped = vendors.map((v) => ({
      id: v.id,
      businessName: v.name,
      ownerName: v.ownerName || v.user?.name,
      phone: v.phone,
      location: v.location || '',
      role: 'vendor',
      status: mapVendorUiStatus(v, v.user),
    }));
    res.json({ success: true, data: { vendors: mapped } });
  } catch (e) {
    next(e);
  }
}

function mapVendorUiStatus(vendor, user) {
  if (user?.accountStatus === UserAccountStatus.blocked) return 'blocked';
  if (!vendor.isVerified) return 'pending';
  return 'active';
}

export async function adminStats(req, res, next) {
  try {
    const [
      loansByStatus,
      userCount,
      farmerCount,
      vendorUserCount,
      vendorProfileCount,
      groupCount,
      productCount,
    ] = await Promise.all([
      prisma.loan.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.user } }),
      prisma.user.count({ where: { role: Role.vendor } }),
      prisma.vendor.count(),
      prisma.group.count(),
      prisma.product.count(),
    ]);
    res.json({
      success: true,
      data: {
        loansByStatus,
        users: userCount,
        farmers: farmerCount,
        vendorUsers: vendorUserCount,
        vendors: vendorProfileCount,
        groups: groupCount,
        products: productCount,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function listFarmers(req, res, next) {
  try {
    const farmers = await prisma.user.findMany({
      where: { role: Role.user },
      select: {
        id: true,
        name: true,
        phone: true,
        nationalId: true,
        creditScore: true,
        farmSize: true,
        cropType: true,
        location: true,
        accountStatus: true,
        groupId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = farmers.map((f) => ({
      ...f,
      role: 'farmer',
      status: mapAccountStatus(f.accountStatus),
    }));
    res.json({ success: true, data: { farmers: mapped } });
  } catch (e) {
    next(e);
  }
}

function mapAccountStatus(s) {
  if (s === UserAccountStatus.suspended) return 'suspended';
  if (s === UserAccountStatus.blocked) return 'blocked';
  if (s === UserAccountStatus.pending) return 'pending';
  return 'active';
}

export async function updateFarmerStatus(req, res, next) {
  try {
    const { id } = req.params;
    const status = String(req.body.status || '').trim();
    const map = {
      active: UserAccountStatus.active,
      suspended: UserAccountStatus.suspended,
      blocked: UserAccountStatus.blocked,
    };
    if (!map[status]) throw new AppError('Invalid status', 400);
    const farmer = await prisma.user.findFirst({
      where: { id, role: Role.user },
    });
    if (!farmer) throw new AppError('Farmer not found', 404);
    await prisma.user.update({
      where: { id },
      data: { accountStatus: map[status] },
    });
    res.json({ success: true, message: 'Farmer updated' });
  } catch (e) {
    next(e);
  }
}

export async function verifyVendor(req, res, next) {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!vendor?.user) throw new AppError('Vendor not found', 404);
    await prisma.vendor.update({
      where: { id },
      data: { isVerified: true },
    });
    await prisma.user.update({
      where: { id: vendor.userId },
      data: { accountStatus: UserAccountStatus.active },
    });
    await notifyUser(
      vendor.userId,
      'Vendor approved',
      'Your AgroVendor account is active. You can log in and manage inventory.',
      'success',
    );
    res.json({ success: true, message: 'Vendor verified' });
  } catch (e) {
    next(e);
  }
}

export async function rejectVendorSignup(req, res, next) {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor?.userId) throw new AppError('Vendor not found', 404);
    await prisma.user.update({
      where: { id: vendor.userId },
      data: { accountStatus: UserAccountStatus.blocked },
    });
    await prisma.vendor.update({
      where: { id },
      data: { isVerified: false },
    });
    res.json({ success: true, message: 'Vendor rejected' });
  } catch (e) {
    next(e);
  }
}

export async function deleteVendorAccount(req, res, next) {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { _count: { select: { loans: true } } },
    });
    if (!vendor) throw new AppError('Vendor not found', 404);
    if (vendor._count.loans > 0) {
      throw new AppError('Cannot delete vendor with existing loans', 400);
    }
    await prisma.product.deleteMany({ where: { vendorId: id } });
    await prisma.vendorFarmerBlock.deleteMany({ where: { vendorId: id } });
    await prisma.vendor.delete({ where: { id } });
    if (vendor.userId) {
      await prisma.user.delete({ where: { id: vendor.userId } });
    }
    res.json({ success: true, message: 'Vendor removed' });
  } catch (e) {
    next(e);
  }
}

export async function listGroups(req, res, next) {
  try {
    const groups = await prisma.group.findMany({
      include: { users: { select: { id: true } } },
    });
    const mapped = groups.map((g) => ({
      id: g.id,
      name: g.name,
      memberIds: g.users.map((u) => u.id),
      repaymentRate: 100,
    }));
    res.json({ success: true, data: { groups: mapped } });
  } catch (e) {
    next(e);
  }
}

export async function listAllProducts(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      include: { vendor: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: { products } });
  } catch (e) {
    next(e);
  }
}
