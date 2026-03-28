import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

function requireVendor(req) {
  const vendor = req.user.vendor;
  if (!vendor) throw new AppError('Vendor profile not linked to this account', 403);
  return vendor;
}

export async function listProducts(req, res, next) {
  try {
    const vendor = requireVendor(req);
    const products = await prisma.product.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { products } });
  } catch (e) {
    next(e);
  }
}

export async function createProduct(req, res, next) {
  try {
    const vendor = requireVendor(req);
    const { name, category, price, stock } = req.body;
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        name: String(name).trim(),
        category: String(category).trim(),
        price: Number(price),
        stock: Math.max(0, Math.floor(Number(stock))),
      },
    });
    res.status(201).json({ success: true, data: { product } });
  } catch (e) {
    next(e);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const vendor = requireVendor(req);
    const { id } = req.params;
    const existing = await prisma.product.findFirst({
      where: { id, vendorId: vendor.id },
    });
    if (!existing) throw new AppError('Product not found', 404);
    const { name, category, price, stock } = req.body;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(category != null ? { category: String(category).trim() } : {}),
        ...(price != null ? { price: Number(price) } : {}),
        ...(stock != null ? { stock: Math.max(0, Math.floor(Number(stock))) } : {}),
      },
    });
    res.json({ success: true, data: { product } });
  } catch (e) {
    next(e);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const vendor = requireVendor(req);
    const { id } = req.params;
    const existing = await prisma.product.findFirst({
      where: { id, vendorId: vendor.id },
    });
    if (!existing) throw new AppError('Product not found', 404);
    await prisma.product.delete({ where: { id } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (e) {
    next(e);
  }
}
