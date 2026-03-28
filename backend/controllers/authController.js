import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { assignFarmerToGroup } from '../services/groupService.js';
import { Role, UserAccountStatus } from '../lib/db.js';

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('JWT_SECRET not set', 500);
  return jwt.sign(
    { sub: user.id, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

/** Farmers self-register (role user only). */
export async function register(req, res, next) {
  try {
    const {
      name,
      phone,
      nationalId,
      password,
      farmSize,
      cropType,
      location,
    } = req.body;
    const normalizedPhone = String(phone).trim();
    const exists = await prisma.user.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { nationalId: String(nationalId).trim() }],
      },
    });
    if (exists) {
      throw new AppError('Phone or National ID already registered', 409);
    }
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        nationalId: String(nationalId).trim(),
        password: hash,
        role: Role.user,
        accountStatus: UserAccountStatus.active,
        farmSize: farmSize != null ? String(farmSize).trim() : null,
        cropType: cropType != null ? String(cropType).trim() : null,
        location: location != null ? String(location).trim() : null,
      },
    });
    await assignFarmerToGroup(user.id);
    const token = signToken(user);
    const { password: _, ...safe } = user;
    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      data: { user: safe, token },
    });
  } catch (e) {
    next(e);
  }
}

/** Vendor self-registration — pending until admin verifies. */
export async function registerVendor(req, res, next) {
  try {
    const {
      businessName,
      ownerName,
      phone,
      password,
      location,
      walletNumber,
    } = req.body;
    const normalizedPhone = String(phone).trim();
    const exists = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (exists) {
      throw new AppError('Phone already registered', 409);
    }
    const hash = await bcrypt.hash(password, 12);
    const nationalId = await generateUniqueVendorNationalId();
    const user = await prisma.user.create({
      data: {
        name: String(businessName).trim(),
        phone: normalizedPhone,
        nationalId,
        password: hash,
        role: Role.vendor,
        accountStatus: UserAccountStatus.pending,
        location: location != null ? String(location).trim() : null,
      },
    });
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        name: String(businessName).trim(),
        ownerName: ownerName != null ? String(ownerName).trim() : null,
        phone: normalizedPhone,
        location: location != null ? String(location).trim() : null,
        walletNumber: String(walletNumber || normalizedPhone).trim(),
        isVerified: false,
      },
    });
    const { password: _, ...safe } = user;
    res.status(201).json({
      success: true,
      message: 'Registration received. Waiting for admin approval.',
      data: {
        user: safe,
        vendorId: vendor.id,
      },
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

export async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    const normalizedPhone = String(phone).trim();
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: { vendor: true },
    });
    if (!user) {
      throw new AppError('Invalid phone or password', 401);
    }
    if (user.accountStatus === UserAccountStatus.suspended) {
      throw new AppError('Account is suspended', 403);
    }
    if (user.accountStatus === UserAccountStatus.blocked) {
      throw new AppError('Account is blocked', 403);
    }
    if (user.role === Role.vendor && user.vendor && !user.vendor.isVerified) {
      throw new AppError('Account pending admin approval', 403);
    }
    if (user.accountStatus === UserAccountStatus.pending && user.role === Role.vendor) {
      throw new AppError('Account pending admin approval', 403);
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new AppError('Invalid phone or password', 401);
    }
    const token = signToken(user);
    const { password: _, ...safe } = user;
    res.json({
      success: true,
      data: {
        user: safe,
        token,
        vendorId: user.vendor?.id ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
}
