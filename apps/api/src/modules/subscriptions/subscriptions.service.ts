import { Prisma, Role, SubscriptionFrequency } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { notify } from '../notifications/notifications.service.js';
import { ordersService } from '../orders/orders.service.js';
import { paymentsService } from '../payments/payments.service.js';
import type { AuthUser } from '../../core/interfaces/index.js';
import type { CreateSubscriptionBody, SubscriptionQuery } from './subscriptions.schema.js';

const include = {
  items: { include: { product: { select: { id: true, name: true, price: true, type: true } } } },
  address: { select: { id: true, label: true, street: true, city: true, zoneId: true } },
  slot: true,
} satisfies Prisma.SubscriptionInclude;

const RUN_HOUR_UTC = 1; // 08:00 WIB

/** Jadwal berikutnya (> from) pada pukul 08:00 WIB */
export function computeNextRun(s: { frequency: SubscriptionFrequency; dayOfWeek?: number | null; dayOfMonth?: number | null }, from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), RUN_HOUR_UTC, 0, 0));
  if (s.frequency === 'MONTHLY') {
    const day = s.dayOfMonth ?? 1;
    d.setUTCDate(day);
    if (d <= from) {
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(day);
    }
    return d;
  }
  const target = s.dayOfWeek ?? 1;
  let diff = (target - d.getUTCDay() + 7) % 7;
  if (diff === 0 && d <= from) diff = 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

const advance = (s: { frequency: SubscriptionFrequency; dayOfWeek: number | null; dayOfMonth: number | null; nextRunAt: Date }) => {
  const base = s.frequency === 'BIWEEKLY' ? new Date(s.nextRunAt.getTime() + 7 * 86_400_000) : s.nextRunAt;
  return computeNextRun(s, base > new Date() ? base : new Date());
};

async function validateRefs(userId: string, b: Partial<CreateSubscriptionBody>) {
  if (b.addressId) {
    const a = await prisma.address.findFirst({ where: { id: b.addressId, userId } });
    if (!a) throw AppError.notFound('Alamat tidak ditemukan');
    if (!a.zoneId) throw AppError.unprocessable('Alamat belum memiliki zona pengiriman');
  }
  if (b.slotId && !(await prisma.deliverySlot.findFirst({ where: { id: b.slotId, isActive: true } }))) throw AppError.unprocessable('Slot tidak tersedia');
  if (b.items) {
    const n = await prisma.product.count({ where: { id: { in: b.items.map((i) => i.productId) }, deletedAt: null, isActive: true } });
    if (n !== b.items.length) throw AppError.unprocessable('Sebagian produk tidak tersedia');
  }
}

async function own(user: AuthUser, id: string) {
  const s = await prisma.subscription.findFirst({ where: { id, ...(user.role !== Role.ADMIN && { userId: user.id }) }, include });
  if (!s) throw AppError.notFound('Langganan tidak ditemukan');
  return s;
}

export const subscriptionsService = {
  async list(user: AuthUser, q: SubscriptionQuery) {
    const where: Prisma.SubscriptionWhereInput = {
      ...(user.role !== Role.ADMIN ? { userId: user.id } : q.userId ? { userId: q.userId } : {}),
      ...(q.status && { status: q.status }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({ where, skip, take, orderBy: { nextRunAt: 'asc' }, include }),
      prisma.subscription.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  get: (user: AuthUser, id: string) => own(user, id),

  async create(userId: string, b: CreateSubscriptionBody) {
    await validateRefs(userId, b);
    const { items, ...rest } = b;
    return prisma.subscription.create({
      data: { ...rest, userId, nextRunAt: computeNextRun(b), items: { create: items } },
      include,
    });
  },

  async update(userId: string, id: string, b: Partial<CreateSubscriptionBody>) {
    const cur = await own({ id: userId, role: Role.CUSTOMER } as AuthUser, id);
    if (cur.status === 'CANCELLED') throw AppError.unprocessable('Langganan sudah dibatalkan');
    await validateRefs(userId, b);
    const { items, ...rest } = b;
    const schedule = { frequency: rest.frequency ?? cur.frequency, dayOfWeek: rest.dayOfWeek ?? cur.dayOfWeek, dayOfMonth: rest.dayOfMonth ?? cur.dayOfMonth };
    const rescheduled = rest.frequency || rest.dayOfWeek !== undefined || rest.dayOfMonth !== undefined;
    return prisma.$transaction(async (tx) => {
      if (items) {
        await tx.subscriptionItem.deleteMany({ where: { subscriptionId: id } });
        await tx.subscriptionItem.createMany({ data: items.map((i) => ({ ...i, subscriptionId: id })) });
      }
      return tx.subscription.update({ where: { id }, data: { ...rest, ...(rescheduled && { nextRunAt: computeNextRun(schedule) }) }, include });
    });
  },

  async pause(userId: string, id: string, until?: Date) {
    const cur = await own({ id: userId, role: Role.CUSTOMER } as AuthUser, id);
    if (cur.status !== 'ACTIVE') throw AppError.unprocessable('Hanya langganan ACTIVE yang dapat dijeda');
    return prisma.subscription.update({ where: { id }, data: { status: 'PAUSED', pausedUntil: until ?? null }, include });
  },

  async resume(userId: string, id: string) {
    const cur = await own({ id: userId, role: Role.CUSTOMER } as AuthUser, id);
    if (cur.status !== 'PAUSED') throw AppError.unprocessable('Langganan tidak sedang dijeda');
    return prisma.subscription.update({ where: { id }, data: { status: 'ACTIVE', pausedUntil: null, nextRunAt: computeNextRun(cur) }, include });
  },

  async cancel(user: AuthUser, id: string) {
    const cur = await own(user, id);
    if (cur.status === 'CANCELLED') return cur;
    return prisma.subscription.update({ where: { id }, data: { status: 'CANCELLED' }, include });
  },

  /** Dipanggil job: buat pesanan untuk langganan yang jatuh tempo */
  async runDue(now = new Date()) {
    // auto-resume langganan yang masa jedanya selesai
    await prisma.subscription.updateMany({ where: { status: 'PAUSED', pausedUntil: { lte: now } }, data: { status: 'ACTIVE', pausedUntil: null } });

    const due = await prisma.subscription.findMany({ where: { status: 'ACTIVE', nextRunAt: { lte: now } }, include: { items: true } });
    let created = 0;
    for (const s of due) {
      // klaim jadwal secara atomik agar tidak terbuat ganda bila job berjalan paralel
      const next = advance(s);
      const claimed = await prisma.subscription.updateMany({ where: { id: s.id, nextRunAt: s.nextRunAt }, data: { nextRunAt: next, lastRunAt: now } });
      if (!claimed.count) continue;
      try {
        const order = await ordersService.checkout(
          s.userId,
          { addressId: s.addressId, slotId: s.slotId ?? undefined, scheduledDate: s.slotId ? new Date() : undefined, items: s.items.map((i) => ({ productId: i.productId, quantity: i.quantity })), customerNote: 'Pesanan langganan' },
          { subscriptionId: s.id, clearCart: false },
        );
        if (s.paymentMethod) {
          const user = await prisma.user.findUniqueOrThrow({ where: { id: s.userId }, select: { id: true, role: true, email: true, name: true } });
          await paymentsService.create(user, { orderId: order.id, method: s.paymentMethod }).catch((e) => console.error('[subscription] gagal membuat pembayaran', e));
        }
        await notify({ userId: s.userId, type: 'ORDER', title: 'Pesanan langganan dibuat', body: `Pesanan ${order.orderNumber} dari langganan Anda telah dibuat.`, data: { orderId: order.id, subscriptionId: s.id } });
        created++;
      } catch (e) {
        console.error('[subscription] gagal membuat pesanan', s.id, e);
        await notify({ userId: s.userId, type: 'SYSTEM', title: 'Pesanan langganan gagal dibuat', body: e instanceof AppError ? e.message : 'Terjadi kesalahan saat membuat pesanan langganan.', data: { subscriptionId: s.id } });
      }
    }
    return { due: due.length, created };
  },
};
