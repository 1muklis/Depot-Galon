import { PaymentGateway, PaymentStatus, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { getProvider } from '../../integrations/payment/index.js';
import type { WebhookResult } from '../../integrations/payment/index.js';
import { notify } from '../notifications/notifications.service.js';
import { settlePayment } from '../payments/payments.service.js';

async function apply(logId: string, gateway: PaymentGateway, r: WebhookResult) {
  const payment = r.externalId ? await prisma.payment.findUnique({ where: { externalId: r.externalId }, include: { order: true } }) : null;
  if (!payment) {
    await prisma.paymentWebhookLog.update({ where: { id: logId }, data: { errorMessage: 'Payment dengan externalId tersebut tidak ditemukan' } });
    return { processed: false };
  }
  if (payment.gateway !== gateway) {
    await prisma.paymentWebhookLog.update({ where: { id: logId }, data: { paymentId: payment.id, errorMessage: 'Gateway tidak cocok dengan data pembayaran' } });
    return { processed: false };
  }
  // jangan percaya jumlah yang tidak cocok (mencegah pelunasan dengan nominal lebih kecil)
  if (r.status === PaymentStatus.PAID && r.amount !== undefined && r.amount !== Math.round(payment.amount.toNumber())) {
    await prisma.paymentWebhookLog.update({ where: { id: logId }, data: { paymentId: payment.id, errorMessage: `Nominal tidak cocok: diterima ${r.amount}, seharusnya ${payment.amount.toFixed(0)}` } });
    return { processed: false };
  }
  const out = await prisma.$transaction((tx) =>
    settlePayment(tx, payment.id, { status: r.status ?? PaymentStatus.PENDING, transactionId: r.transactionId, raw: { eventType: r.eventType } }),
  );
  await prisma.paymentWebhookLog.update({ where: { id: logId }, data: { paymentId: payment.id, processed: true, errorMessage: null } });
  if (out.changed && r.status === PaymentStatus.PAID) {
    await notify({ userId: payment.order.userId, type: 'PAYMENT', title: 'Pembayaran berhasil', body: `Pembayaran pesanan ${payment.order.orderNumber} telah diterima.`, data: { orderId: payment.orderId, paymentId: payment.id } });
  }
  return { processed: true };
}

export const paymentWebhooksService = {
  /** Mengembalikan false bila signature tidak valid (controller membalas 401) */
  async receive(gateway: PaymentGateway, req: Request) {
    const provider = getProvider(gateway);
    const result = provider.parseWebhook({ headers: req.headers, body: req.body, rawBody: req.rawBody, path: req.originalUrl.split('?')[0]! });
    const log = await prisma.paymentWebhookLog.create({
      data: {
        gateway, eventType: result.eventType, externalId: result.externalId, signature: result.signature?.slice(0, 500), isValid: result.valid,
        payload: { body: req.body ?? {}, parsed: { status: result.status, amount: result.amount, transactionId: result.transactionId } } as Prisma.InputJsonValue,
        errorMessage: result.valid ? null : result.error ?? 'Signature tidak valid',
      },
    });
    if (!result.valid) return { valid: false as const };
    try {
      await apply(log.id, gateway, result);
    } catch (e) {
      await prisma.paymentWebhookLog.update({ where: { id: log.id }, data: { errorMessage: String(e).slice(0, 500) } });
      throw e; // balas 500 agar gateway mencoba lagi
    }
    return { valid: true as const };
  },

  async list(q: { page?: number; limit?: number; gateway?: PaymentGateway; processed?: boolean; isValid?: boolean; externalId?: string }) {
    const where: Prisma.PaymentWebhookLogWhereInput = {
      ...(q.gateway && { gateway: q.gateway }),
      ...(q.processed !== undefined && { processed: q.processed }),
      ...(q.isValid !== undefined && { isValid: q.isValid }),
      ...(q.externalId && { externalId: { contains: q.externalId } }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.paymentWebhookLog.findMany({ where, skip, take, orderBy: { receivedAt: 'desc' } }),
      prisma.paymentWebhookLog.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(id: string) {
    const log = await prisma.paymentWebhookLog.findUnique({ where: { id } });
    if (!log) throw AppError.notFound('Log webhook tidak ditemukan');
    return log;
  },

  /** Proses ulang log yang valid tapi gagal diproses (memakai hasil parse yang tersimpan) */
  async reprocess(id: string) {
    const log = await this.get(id);
    if (!log.isValid) throw AppError.unprocessable('Log dengan signature tidak valid tidak dapat diproses ulang');
    if (log.processed) throw AppError.conflict('Log sudah diproses');
    const parsed = (log.payload as any)?.parsed ?? {};
    const out = await apply(log.id, log.gateway, {
      valid: true, externalId: log.externalId ?? undefined, status: parsed.status, amount: parsed.amount, transactionId: parsed.transactionId, eventType: log.eventType ?? undefined,
    });
    return { ...out, log: await this.get(id) };
  },
};
