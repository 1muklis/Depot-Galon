import { Prisma, StockMovementType } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Tx } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import type { MovementQuery } from './stock-movements.schema.js';

/** Perubahan bersih pada kolom `quantity` stok */
const delta = (type: StockMovementType, qty: number) => (type === 'OUT' ? -Math.abs(qty) : type === 'ADJUSTMENT' ? qty : Math.abs(qty));

/**
 * Mencatat pergerakan stok + memperbarui kolom quantity secara atomik.
 * Update memakai kondisi SQL sehingga tidak bisa membuat quantity < reserved (race-safe).
 */
export async function applyStockMovement(
  tx: Tx,
  i: { productId: string; type: StockMovementType; quantity: number; note?: string; referenceId?: string; createdById?: string | null },
) {
  const d = delta(i.type, i.quantity);
  const updated = await tx.$executeRaw`
    UPDATE stocks SET quantity = quantity + ${d}, "updatedAt" = NOW()
    WHERE "productId" = ${i.productId} AND quantity + ${d} >= reserved`;
  if (updated === 0) {
    const exists = await tx.stock.findUnique({ where: { productId: i.productId } });
    if (!exists) throw AppError.notFound('Stok produk tidak ditemukan');
    throw AppError.unprocessable('Stok tidak mencukupi (tidak boleh kurang dari jumlah yang sudah direservasi)', ErrorCodes.OUT_OF_STOCK);
  }
  return tx.stockMovement.create({
    data: { productId: i.productId, type: i.type, quantity: i.quantity, note: i.note, referenceId: i.referenceId, createdById: i.createdById ?? null },
  });
}

export const stockMovementsService = {
  async list(q: MovementQuery) {
    const where: Prisma.StockMovementWhereInput = {
      ...(q.productId && { productId: q.productId }),
      ...(q.type && { type: q.type }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { product: { select: { id: true, name: true, sku: true } }, createdBy: { select: { id: true, name: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async create(userId: string, b: { productId: string; type: StockMovementType; quantity: number; note?: string; referenceId?: string }) {
    const product = await prisma.product.findFirst({ where: { id: b.productId, deletedAt: null } });
    if (!product) throw AppError.notFound('Produk tidak ditemukan');
    return prisma.$transaction(async (tx) => {
      const m = await applyStockMovement(tx, { ...b, createdById: userId });
      const stock = await tx.stock.findUniqueOrThrow({ where: { productId: b.productId } });
      return { movement: m, stock: { quantity: stock.quantity, reserved: stock.reserved, available: stock.quantity - stock.reserved } };
    });
  },
};
