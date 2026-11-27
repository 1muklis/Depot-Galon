import { PaymentGateway, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Tx } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { addMinutes, shortId } from '../../core/utils/helpers.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { getProvider } from '../../integrations/payment/index.js';
import { storage } from '../../integrations/storage/index.js';
import { notify, notifyAdmins } from '../notifications/notifications.service.js';
import { markOrderPaid, transitionOrder } from '../orders/orders.service.js';
import { settingsService } from '../settings/settings.service.js';
import type { AuthUser } from '../../core/interfaces/index.js';
import type { CreatePaymentBody, PaymentQuery } from './payments.schema.js';

const publicSelect = {
  id: true, orderId: true, gateway: true, method: true, status: true, amount: true, fee: true, currency: true,
  paymentCode: true, bankCode: true, paymentUrl: true, snapToken: true, qrString: true, expiresAt: true, paidAt: true,
  failureReason: true, proofImage: true, createdAt: true,
} satisfies Prisma.PaymentSelect;

type Order = Prisma.OrderGetPayload<{ include: { items: true; user: true } }>;

/** Item untuk gateway: jumlahnya harus sama dengan total (Midtrans memvalidasi ini) */
function buildChargeItems(o: Order) {
  const items = o.items.map((i) => ({ name: i.productName, price: Math.round(i.unitPrice.toNumber()), quantity: i.quantity }));
  const extra = (name: string, v: Prisma.Decimal, sign = 1) => {
    const n = Math.round(v.toNumber()) * sign;
    if (n !== 0) items.push({ name, price: n, quantity: 1 });
  };
  extra('Ongkos kirim', o.shippingFee);
  extra('Biaya layanan', o.serviceFee);
  extra('Deposit galon', o.depositAmount);
  extra('Diskon', o.discountAmount, -1);
  return items;
}

/**
 * Menyelesaikan status pembayaran (idempoten). Dipakai webhook, verifikasi manual, dan COD.
 * Bila uang masuk untuk order yang sudah tidak menunggu pembayaran (dibatalkan / sudah lunas
 * lewat pembayaran lain), otomatis dibuat permintaan refund agar dana tidak "tertahan".
 */
export async function settlePayment(
  tx: Tx,
  paymentId: string,
  r: { status: PaymentStatus; transactionId?: string; paidAt?: Date; failureReason?: string; verifiedBy?: string; raw?: unknown },
) {
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  if (payment.status === PaymentStatus.PAID && r.status === PaymentStatus.PAID) return { payment, changed: false };
  if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED) return { payment, changed: false };

  if (r.status === PaymentStatus.PAID) {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID, paidAt: r.paidAt ?? new Date(),
        transactionId: payment.transactionId ?? r.transactionId,
        ...(r.verifiedBy && { verifiedBy: r.verifiedBy, verifiedAt: new Date() }),
        ...(r.raw !== undefined && { rawResponse: r.raw as Prisma.InputJsonValue }),
      },
    });
    if (payment.order.status === 'PENDING_PAYMENT') {
      await markOrderPaid(tx, payment.orderId, `Pembayaran ${payment.gateway}/${payment.method} diterima`);
      // pembayaran lain yang masih menggantung tidak diperlukan lagi
      await tx.payment.updateMany({ where: { orderId: payment.orderId, status: 'PENDING', id: { not: paymentId } }, data: { status: 'CANCELLED' } });
    } else {
      await tx.refund.create({
        data: { orderId: payment.orderId, paymentId, amount: payment.amount, reason: `Otomatis: pembayaran diterima saat pesanan berstatus ${payment.order.status}` },
      });
    }
    return { payment: updated, changed: true };
  }

  if (payment.status === PaymentStatus.PENDING) {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: r.status, failureReason: r.failureReason, ...(r.raw !== undefined && { rawResponse: r.raw as Prisma.InputJsonValue }) },
    });
    return { payment: updated, changed: true };
  }
  return { payment, changed: false };
}

/** Dipanggil modul deliveries ketika kurir menerima uang COD */
export async function collectCodPayment(tx: Tx, orderId: string, courierProfileId: string) {
  const payment = await tx.payment.findFirst({ where: { orderId, method: 'COD', status: 'PENDING' } });
  if (!payment) return null;
  await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', paidAt: new Date(), codCollectedBy: courierProfileId } });
  await tx.order.update({ where: { id: orderId }, data: { paidAt: new Date() } });
  return payment;
}

export const paymentsService = {
  async create(user: AuthUser, b: CreatePaymentBody) {
    const order = await prisma.order.findFirst({ where: { id: b.orderId, userId: user.id }, include: { items: true, user: true } });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    if (order.status !== 'PENDING_PAYMENT') throw AppError.unprocessable('Pesanan tidak menunggu pembayaran', ErrorCodes.PAYMENT_NOT_ALLOWED);

    const gateway: PaymentGateway = b.method === 'COD' ? 'COD' : b.gateway ?? (b.method === 'BANK_TRANSFER' ? 'MANUAL' : env.DEFAULT_PAYMENT_GATEWAY);
    const amount = order.totalAmount;

    // Pembayaran tertunda sebelumnya: pakai ulang bila identik & belum kedaluwarsa, selain itu batalkan
    const pending = await prisma.payment.findMany({ where: { orderId: order.id, status: 'PENDING' } });
    for (const p of pending) {
      const alive = !p.expiresAt || p.expiresAt > new Date();
      if (alive && p.gateway === gateway && p.method === b.method && p.bankCode === (b.bankCode ?? null)) {
        return { ...(await this.get(user, p.id)), reused: true };
      }
    }
    if (pending.length) await prisma.payment.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: 'CANCELLED' } });

    // Total Rp0 (mis. voucher 100%) -> langsung lunas
    if (amount.lte(0)) {
      const created = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({ data: { orderId: order.id, gateway: 'MANUAL', method: b.method, status: 'PAID', amount, paidAt: new Date(), externalId: `${order.orderNumber}-${shortId()}` } });
        await markOrderPaid(tx, order.id, 'Total pembayaran Rp0');
        return p;
      });
      return prisma.payment.findUniqueOrThrow({ where: { id: created.id }, select: publicSelect });
    }

    const externalId = `${order.orderNumber}-${shortId()}`;

    if (gateway === 'COD') {
      const p = await prisma.$transaction(async (tx) => {
        const row = await tx.payment.create({ data: { orderId: order.id, gateway, method: 'COD', status: 'PENDING', amount, externalId } });
        await tx.delivery.updateMany({ where: { orderId: order.id }, data: { codAmount: amount } });
        await transitionOrder(tx, order.id, 'PROCESSING', { note: 'Bayar di tempat (COD)', changedBy: user.id });
        return row;
      });
      await notifyAdmins({ type: 'ORDER', title: 'Pesanan COD', body: `Pesanan ${order.orderNumber} (COD) siap diproses.`, data: { orderId: order.id } });
      return prisma.payment.findUniqueOrThrow({ where: { id: p.id }, select: publicSelect });
    }

    if (gateway === 'MANUAL') {
      const p = await prisma.payment.create({
        data: { orderId: order.id, gateway, method: b.method, status: 'PENDING', amount, externalId, bankCode: b.bankCode, expiresAt: addMinutes(new Date(), env.PAYMENT_EXPIRY_MINUTES) },
        select: publicSelect,
      });
      const instructions = await settingsService.get('payment.manual_instructions');
      return { ...p, instructions };
    }

    const provider = getProvider(gateway);
    const charge = await provider.createCharge({
      externalId, amount: Math.round(amount.toNumber()), method: b.method, bankCode: b.bankCode,
      customer: { name: order.user.name, email: order.user.email, phone: order.user.phone },
      items: buildChargeItems(order),
      expiresInMinutes: env.PAYMENT_EXPIRY_MINUTES,
      returnUrl: `${env.FRONTEND_URL}/orders/${order.id}`,
    });
    return prisma.payment.create({
      data: {
        orderId: order.id, gateway, method: b.method, status: 'PENDING', amount, externalId,
        transactionId: charge.transactionId, paymentCode: charge.paymentCode, bankCode: charge.bankCode ?? b.bankCode,
        paymentUrl: charge.paymentUrl, snapToken: charge.snapToken, qrString: charge.qrString,
        rawResponse: charge.raw as Prisma.InputJsonValue, expiresAt: charge.expiresAt ?? addMinutes(new Date(), env.PAYMENT_EXPIRY_MINUTES),
      },
      select: publicSelect,
    });
  },

  async list(user: AuthUser, q: PaymentQuery) {
    const where: Prisma.PaymentWhereInput = {
      ...(user.role !== Role.ADMIN && { order: { userId: user.id } }),
      ...(q.status && { status: q.status }),
      ...(q.gateway && { gateway: q.gateway }),
      ...(q.method && { method: q.method }),
      ...(q.orderId && { orderId: q.orderId }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
      ...(q.search && { OR: [{ externalId: { contains: q.search, mode: 'insensitive' } }, { order: { orderNumber: { contains: q.search, mode: 'insensitive' } } }] }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.payment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: { ...publicSelect, order: { select: { orderNumber: true, userId: true } } } }),
      prisma.payment.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(user: AuthUser, id: string) {
    const p = await prisma.payment.findFirst({
      where: { id, ...(user.role !== Role.ADMIN && { order: { userId: user.id } }) },
      select: { ...publicSelect, externalId: true, transactionId: true, verifiedBy: true, verifiedAt: true, order: { select: { orderNumber: true, totalAmount: true, status: true } } },
    });
    if (!p) throw AppError.notFound('Pembayaran tidak ditemukan');
    return p;
  },

  async uploadProof(user: AuthUser, id: string, file: Express.Multer.File) {
    const p = await prisma.payment.findFirst({ where: { id, order: { userId: user.id } }, include: { order: true } });
    if (!p) throw AppError.notFound('Pembayaran tidak ditemukan');
    if (p.gateway !== 'MANUAL' || p.status !== 'PENDING') throw AppError.unprocessable('Bukti hanya dapat diunggah untuk pembayaran manual yang menunggu', ErrorCodes.PAYMENT_NOT_ALLOWED);
    const url = await storage.save(file, 'payment-proofs');
    if (p.proofImage) await storage.remove(p.proofImage);
    await prisma.payment.update({ where: { id }, data: { proofImage: url } });
    await notifyAdmins({ type: 'PAYMENT', title: 'Bukti transfer diunggah', body: `Pesanan ${p.order.orderNumber} menunggu verifikasi.`, data: { paymentId: id, orderId: p.orderId } });
    return { proofImage: url };
  },

  async verifyManual(adminId: string, id: string, approve: boolean, reason?: string) {
    const p = await prisma.payment.findUnique({ where: { id }, include: { order: true } });
    if (!p) throw AppError.notFound('Pembayaran tidak ditemukan');
    if (p.gateway !== 'MANUAL' || p.status !== 'PENDING') throw AppError.unprocessable('Hanya pembayaran manual berstatus PENDING yang dapat diverifikasi', ErrorCodes.PAYMENT_NOT_ALLOWED);
    if (approve && !p.proofImage) throw AppError.unprocessable('Customer belum mengunggah bukti pembayaran');
    await prisma.$transaction((tx) =>
      settlePayment(tx, id, approve ? { status: 'PAID', verifiedBy: adminId } : { status: 'FAILED', failureReason: reason }),
    );
    if (!approve) await prisma.payment.update({ where: { id }, data: { verifiedBy: adminId, verifiedAt: new Date() } });
    await notify({
      userId: p.order.userId, type: 'PAYMENT',
      title: approve ? 'Pembayaran diverifikasi' : 'Pembayaran ditolak',
      body: approve ? `Pembayaran pesanan ${p.order.orderNumber} telah diterima.` : `Pembayaran pesanan ${p.order.orderNumber} ditolak: ${reason}`,
      data: { orderId: p.orderId, paymentId: id },
    });
    return prisma.payment.findUniqueOrThrow({ where: { id }, select: publicSelect });
  },

  async cancel(user: AuthUser, id: string) {
    const p = await prisma.payment.findFirst({ where: { id, ...(user.role !== Role.ADMIN && { order: { userId: user.id } }) } });
    if (!p) throw AppError.notFound('Pembayaran tidak ditemukan');
    if (p.status !== 'PENDING') throw AppError.unprocessable('Hanya pembayaran PENDING yang dapat dibatalkan', ErrorCodes.PAYMENT_NOT_ALLOWED);
    if (p.method === 'COD') throw AppError.unprocessable('Pembayaran COD dibatalkan lewat pembatalan pesanan', ErrorCodes.PAYMENT_NOT_ALLOWED);
    return prisma.payment.update({ where: { id }, data: { status: 'CANCELLED' }, select: publicSelect });
  },
};
