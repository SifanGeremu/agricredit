import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { assignFarmerToGroup } from '../services/groupService.js';
import { Role } from '../lib/db.js';

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('JWT_SECRET not set', 500);
  return jwt.sign(
    { sub: user.id, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

/** Farmers self-register (role user only). Admins/vendors are provisioned via seed or admin. */
export async function register(req, res, next) {
  try {
    const { name, phone, nationalId, password } = req.body;
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
