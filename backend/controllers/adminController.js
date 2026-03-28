import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { disburseToVendor } from '../services/mpesaService.js';
import { addMonths } from '../services/loanRules.js';
import { smsLoanApproved, smsLoanDisbursed } from '../services/smsSimulator.js';
import { LoanStatus, Role } from '../lib/db.js';

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
      include: { user: { select: { id: true, phone: true, name: true } } },
    });
    res.json({ success: true, data: { vendors } });
  } catch (e) {
    next(e);
  }
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
      },
    });
  } catch (e) {
    next(e);
  }
}
