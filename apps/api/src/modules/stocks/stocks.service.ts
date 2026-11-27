import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import type { StockQuery } from './stocks.schema.js';

const shape = (s: { quantity: number; reserved: number; minStock: number } & Record<string, unknown>) => ({
  ...s,
  available: Math.max(0, s.quantity - s.reserved),
  isLow: s.quantity - s.reserved <= s.minStock,
});

export const stocksService = {
  async list(q: StockQuery) {
    const { page, limit, skip, take } = getPagination(q);
    const productWhere: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.search && { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }] }),
    };
    if (q.lowStock) {
      // kolom dibandingkan satu sama lain -> raw query untuk id, lalu ambil lewat prisma
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM stocks s JOIN products p ON p.id = s."productId"
        WHERE p."deletedAt" IS NULL AND (s.quantity - s.reserved) <= s."minStock"`;
      const where: Prisma.StockWhereInput = { id: { in: ids.map((i) => i.id) }, product: productWhere };
      const [items, total] = await Promise.all([
        prisma.stock.findMany({ where, skip, take, include: { product: { select: { id: true, name: true, sku: true, type: true } } }, orderBy: { quantity: 'asc' } }),
        prisma.stock.count({ where }),
      ]);
      return { items: items.map(shape), meta: buildMeta(page, limit, total) };
    }
    const where: Prisma.StockWhereInput = { product: productWhere };
    const [items, total] = await Promise.all([
      prisma.stock.findMany({ where, skip, take, include: { product: { select: { id: true, name: true, sku: true, type: true } } }, orderBy: { updatedAt: 'desc' } }),
      prisma.stock.count({ where }),
    ]);
    return { items: items.map(shape), meta: buildMeta(page, limit, total) };
  },

  async get(productId: string) {
    const s = await prisma.stock.findUnique({ where: { productId }, include: { product: { select: { id: true, name: true, sku: true, type: true } } } });
    if (!s) throw AppError.notFound('Stok produk tidak ditemukan');
    return shape(s);
  },

  async updateSettings(productId: string, minStock: number) {
    const s = await prisma.stock.update({ where: { productId }, data: { minStock } });
    return shape(s);
  },
};
