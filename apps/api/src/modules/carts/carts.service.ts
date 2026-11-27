import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { D } from '../../core/utils/helpers.js';
import { resolveUnitPrice } from '../products/products.service.js';

async function ensureCart(userId: string) {
  return prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
}

async function validateQty(productId: string, qty: number) {
  const p = await prisma.product.findFirst({ where: { id: productId, deletedAt: null, isActive: true }, include: { stock: true } });
  if (!p) throw AppError.notFound('Produk tidak ditemukan atau tidak tersedia');
  if (qty < p.minOrderQty) throw AppError.unprocessable(`Minimal pembelian ${p.minOrderQty}`);
  if (p.maxOrderQty && qty > p.maxOrderQty) throw AppError.unprocessable(`Maksimal pembelian ${p.maxOrderQty}`);
  const available = (p.stock?.quantity ?? 0) - (p.stock?.reserved ?? 0);
  if (qty > available) throw AppError.unprocessable(`Stok ${p.name} tersisa ${Math.max(0, available)}`, ErrorCodes.OUT_OF_STOCK);
  return p;
}

export const cartsService = {
  async get(userId: string) {
    const cart = await ensureCart(userId);
    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
      include: {
        product: {
          include: {
            priceTiers: true,
            images: { where: { isPrimary: true }, take: 1 },
            stock: { select: { quantity: true, reserved: true } },
          },
        },
      },
    });
    const lines = items.map((it) => {
      const unitPrice = resolveUnitPrice(it.product, it.product.priceTiers, it.quantity);
      const available = (it.product.stock?.quantity ?? 0) - (it.product.stock?.reserved ?? 0);
      return {
        productId: it.productId,
        name: it.product.name,
        slug: it.product.slug,
        type: it.product.type,
        image: it.product.images[0]?.url ?? null,
        quantity: it.quantity,
        unitPrice,
        subtotal: unitPrice.mul(it.quantity),
        requiresEmptyReturn: it.product.requiresEmptyReturn,
        depositAmount: it.product.depositAmount,
        available: Math.max(0, available),
        isAvailable: it.product.isActive && !it.product.deletedAt && available >= it.quantity,
      };
    });
    const subtotal = lines.reduce((acc, l) => acc.add(l.subtotal), D(0));
    return { id: cart.id, items: lines, totalItems: lines.reduce((n, l) => n + l.quantity, 0), subtotal };
  },

  async addItem(userId: string, productId: string, quantity: number) {
    const cart = await ensureCart(userId);
    const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
    const newQty = (existing?.quantity ?? 0) + quantity;
    await validateQty(productId, newQty);
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity: newQty },
    });
    return this.get(userId);
  },

  /** quantity 0 = hapus item */
  async setQuantity(userId: string, productId: string, quantity: number) {
    const cart = await ensureCart(userId);
    const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
    if (!existing) throw AppError.notFound('Item tidak ada di keranjang');
    if (quantity === 0) await prisma.cartItem.delete({ where: { id: existing.id } });
    else {
      await validateQty(productId, quantity);
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    }
    return this.get(userId);
  },

  async removeItem(userId: string, productId: string) {
    const cart = await ensureCart(userId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.get(userId);
  },

  async clear(userId: string) {
    const cart = await ensureCart(userId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.get(userId);
  },
};
