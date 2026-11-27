import { OrderStatus, Prisma, RefundStatus, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { STOCK_RESERVED_STATUSES } from '../../core/constants/index.js';
import { D } from '../../core/utils/helpers.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { notify, notifyAdmins } from '../notifications/notifications.service.js';
import { releaseStock, transitionOrder } from '../orders/orders.service.js';
import type { AuthUser } from '../../core/interfaces/index.js';
import type { RefundQuery } from './refunds.schema.js';

const REFUNDABLE_ORDER: OrderStatus[] = ['PAID', 'PROCESSING', 'READY_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];
const include = { order: { select: { orderNumber: true, status: true, userId: true, totalAmount: true } }, payment: { select: { gateway: true, method: true, status: true, amount: true } } };

export const refundsService = {
  async create(user: AuthUser, b: { orderId: string; amount?: number; reason: string }) {
    const order = await prisma.order.findFirst({ where: { id: b.orderId, userId: user.id }, include: { payments: { where: { status: { in: ['PAID', 'PARTIAL_REFUND'] } }, orderBy: { paidAt: 'desc' } }, refunds: true } });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    if (!REFUNDABLE_ORDER.includes(order.status)) throw AppError.unprocessable(`Pesanan berstatus ${order.status} tidak dapat direfund`);
    const payment = order.payments[0];
    if (!payment) throw AppError.unprocessable('Tidak ada pembayaran lunas untuk pesanan ini');
    if (order.refunds.some((r) => r.status === 'REQUESTED' || r.status === 'APPROVED')) throw AppError.conflict('Sudah ada pengajuan refund yang sedang diproses');

    const alreadyRefunded = order.refunds.filter((r) => r.status === 'PROCESSED').reduce((a, r) => a.add(r.amount), D(0));
    const refundable = payment.amount.sub(alreadyRefunded);
    const amount = b.amount !== undefined ? D(b.amount) : refundable;
    if (amount.lte(0) || amount.gt(refundable)) throw AppError.unprocessable(`Jumlah refund maksimal Rp${refundable.toFixed(0)}`);

    const r = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, amount, reason: b.reason }, include });
    await notifyAdmins({ type: 'PAYMENT', title: 'Pengajuan refund', body: `Pesanan ${order.orderNumber}: Rp${amount.toFixed(0)}`, data: { refundId: r.id, orderId: order.id } });
    return r;
  },

  async list(user: AuthUser, q: RefundQuery) {
    const where: Prisma.RefundWhereInput = {
      ...(user.role !== Role.ADMIN && { order: { userId: user.id } }),
      ...(q.status && { status: q.status }),
      ...(q.orderId && { orderId: q.orderId }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.refund.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include }),
      prisma.refund.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(user: AuthUser, id: string) {
    const r = await prisma.refund.findFirst({ where: { id, ...(user.role !== Role.ADMIN && { order: { userId: user.id } }) }, include });
    if (!r) throw AppError.notFound('Refund tidak ditemukan');
    return r;
  },

  async decide(adminId: string, id: string, action: 'approve' | 'reject', reason?: string) {
    const r = await prisma.refund.findUnique({ where: { id }, include: { order: true } });
    if (!r) throw AppError.notFound('Refund tidak ditemukan');
    if (r.status !== RefundStatus.REQUESTED) throw AppError.unprocessable(`Refund berstatus ${r.status}`, ErrorCodes.INVALID_STATUS_TRANSITION);
    const updated = await prisma.refund.update({
      where: { id },
      data: action === 'approve' ? { status: 'APPROVED', processedBy: adminId } : { status: 'REJECTED', processedBy: adminId, processedAt: new Date(), reason: `${r.reason} | Ditolak: ${reason}` },
      include,
    });
    await notify({
      userId: r.order.userId, type: 'PAYMENT',
      title: action === 'approve' ? 'Refund disetujui' : 'Refund ditolak',
      body: action === 'approve' ? `Refund pesanan ${r.order.orderNumber} disetujui dan akan diproses.` : `Refund pesanan ${r.order.orderNumber} ditolak: ${reason}`,
      data: { refundId: id, orderId: r.orderId },
    });
    return updated;
  },

  /**
   * Tandai refund sudah dikirim ke customer. Pengembalian dana ke rekening/e-wallet dilakukan
   * di dashboard gateway (atau transfer manual); endpoint ini mencatat hasilnya dan merapikan data.
   */
  async process(adminId: string, id: string, externalRefundId?: string) {
    const r = await prisma.refund.findUnique({ where: { id }, include: { order: true, payment: true } });
    if (!r) throw AppError.notFound('Refund tidak ditemukan');
    if (r.status !== RefundStatus.APPROVED) throw AppError.unprocessable('Refund harus berstatus APPROVED sebelum diproses', ErrorCodes.INVALID_STATUS_TRANSITION);

    await prisma.$transaction(async (tx) => {
      await tx.refund.update({ where: { id }, data: { status: 'PROCESSED', processedBy: adminId, processedAt: new Date(), externalRefundId } });
      if (r.paymentId && r.payment) {
        const agg = await tx.refund.aggregate({ where: { paymentId: r.paymentId, status: 'PROCESSED' }, _sum: { amount: true } });
        const full = (agg._sum.amount ?? D(0)).gte(r.payment.amount);
        await tx.payment.update({ where: { id: r.paymentId }, data: { status: full ? 'REFUNDED' : 'PARTIAL_REFUND' } });

        if (full && r.order.status !== 'CANCELLED' && r.order.status !== 'REFUNDED') {
          const wasReserved = STOCK_RESERVED_STATUSES.includes(r.order.status);
          await transitionOrder(tx, r.orderId, 'REFUNDED', { note: 'Refund penuh diproses', changedBy: adminId });
          if (wasReserved) {
            await releaseStock(tx, r.orderId);
            const d = await tx.delivery.findUnique({ where: { orderId: r.orderId } });
            if (d && !['DELIVERED', 'RETURNED'].includes(d.status)) await tx.delivery.update({ where: { id: d.id }, data: { status: 'RETURNED' } });
          }
        }
      }
    });
    await notify({ userId: r.order.userId, type: 'PAYMENT', title: 'Refund diproses', body: `Dana Rp${r.amount.toFixed(0)} untuk pesanan ${r.order.orderNumber} telah dikembalikan.`, data: { refundId: id, orderId: r.orderId } });
    return prisma.refund.findUniqueOrThrow({ where: { id }, include });
  },
};
