import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { productsService } from '../products/products.service.js';
import type { AuthUser } from '../../core/interfaces/index.js';
import type { ReviewQuery } from './reviews.schema.js';

const include = {
  user: { select: { id: true, name: true, avatar: true } },
  product: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ReviewInclude;

export const reviewsService = {
  async list(q: ReviewQuery, user?: AuthUser, mine = false) {
    const isAdmin = user?.role === Role.ADMIN;
    const where: Prisma.ReviewWhereInput = {
      ...(mine && user ? { userId: user.id } : {}),
      ...(!isAdmin && !mine && { isVisible: true }),
      ...(isAdmin && q.isVisible !== undefined && { isVisible: q.isVisible }),
      ...(q.productId && { productId: q.productId }),
      ...(q.rating && { rating: q.rating }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.review.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include }),
      prisma.review.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async create(userId: string, b: { orderId: string; productId: string; rating: number; comment?: string }) {
    const order = await prisma.order.findFirst({ where: { id: b.orderId, userId }, include: { items: { where: { productId: b.productId } } } });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) throw AppError.unprocessable('Ulasan hanya dapat diberikan setelah pesanan diterima');
    if (!order.items.length) throw AppError.unprocessable('Produk tidak ada dalam pesanan ini');
    if (await prisma.review.findUnique({ where: { userId_productId_orderId: { userId, productId: b.productId, orderId: b.orderId } } })) {
      throw AppError.conflict('Anda sudah mengulas produk ini untuk pesanan tersebut');
    }
    return prisma.$transaction(async (tx) => {
      const r = await tx.review.create({ data: { userId, ...b }, include });
      await productsService.recalcRating(b.productId, tx);
      return r;
    });
  },

  async update(userId: string, id: string, b: { rating?: number; comment?: string | null }) {
    const r = await prisma.review.findFirst({ where: { id, userId } });
    if (!r) throw AppError.notFound('Ulasan tidak ditemukan');
    return prisma.$transaction(async (tx) => {
      const u = await tx.review.update({ where: { id }, data: b, include });
      await productsService.recalcRating(r.productId, tx);
      return u;
    });
  },

  async setVisibility(id: string, isVisible: boolean) {
    const r = await prisma.review.findUnique({ where: { id } });
    if (!r) throw AppError.notFound('Ulasan tidak ditemukan');
    return prisma.$transaction(async (tx) => {
      const u = await tx.review.update({ where: { id }, data: { isVisible }, include });
      await productsService.recalcRating(r.productId, tx);
      return u;
    });
  },

  async remove(user: AuthUser, id: string) {
    const r = await prisma.review.findFirst({ where: { id, ...(user.role !== Role.ADMIN && { userId: user.id }) } });
    if (!r) throw AppError.notFound('Ulasan tidak ditemukan');
    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await productsService.recalcRating(r.productId, tx);
    });
  },
};
