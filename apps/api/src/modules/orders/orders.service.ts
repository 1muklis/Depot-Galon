import { OrderStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Tx } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { SETTING_KEYS } from '../../core/constants/index.js';
import { D, generateOrderNumber, startOfDay } from '../../core/utils/helpers.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { notify, notifyAdmins } from '../notifications/notifications.service.js';
import { settingsService } from '../settings/settings.service.js';
import { resolveUnitPrice } from '../products/products.service.js';
import { validateVoucher } from '../vouchers/vouchers.service.js';
import type { AuthUser } from '../../core/interfaces/index.js';
import type { CheckoutBody, OrderQuery } from './orders.schema.js';

const S = OrderStatus;

/** Alur status yang diizinkan */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [S.PAID, S.PROCESSING /* COD */, S.CANCELLED],
  PAID: [S.PROCESSING, S.CANCELLED, S.REFUNDED],
  PROCESSING: [S.READY_FOR_DELIVERY, S.CANCELLED, S.REFUNDED],
  READY_FOR_DELIVERY: [S.PROCESSING, S.ON_DELIVERY, S.CANCELLED, S.REFUNDED],
  ON_DELIVERY: [S.DELIVERED, S.READY_FOR_DELIVERY],
  DELIVERED: [S.COMPLETED, S.REFUNDED],
  COMPLETED: [S.REFUNDED],
  CANCELLED: [],
  REFUNDED: [],
};

export const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' as const }, select: { id: true, gateway: true, method: true, status: true, amount: true, paymentUrl: true, snapToken: true, qrString: true, paymentCode: true, bankCode: true, expiresAt: true, paidAt: true, createdAt: true } },
  delivery: { include: { courier: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } } } } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  voucher: { select: { code: true, name: true, type: true } },
  zone: { select: { id: true, name: true, estimatedMinutes: true } },
  slot: true,
} satisfies Prisma.OrderInclude;

/** Ubah status dengan validasi alur + catatan riwayat (dipakai modul lain) */
export async function transitionOrder(
  tx: Tx,
  orderId: string,
  to: OrderStatus,
  opts: { note?: string; changedBy?: string | null; data?: Prisma.OrderUpdateInput } = {},
) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
  if (order.status === to) return;
  if (!TRANSITIONS[order.status].includes(to)) {
    throw AppError.unprocessable(`Status tidak dapat diubah dari ${order.status} ke ${to}`, ErrorCodes.INVALID_STATUS_TRANSITION);
  }
  await tx.order.update({ where: { id: orderId }, data: { status: to, ...opts.data } });
  await tx.orderStatusHistory.create({ data: { orderId, status: to, note: opts.note, changedBy: opts.changedBy ?? null } });
}

export const markOrderPaid = (tx: Tx, orderId: string, note = 'Pembayaran diterima') =>
  transitionOrder(tx, orderId, S.PAID, { note, data: { paidAt: new Date() } });

/** Lepas stok reserved (pesanan batal / refund sebelum terkirim) */
export async function releaseStock(tx: Tx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    await tx.$executeRaw`UPDATE stocks SET reserved = GREATEST(reserved - ${it.quantity}, 0), "updatedAt" = NOW() WHERE "productId" = ${it.productId}`;
  }
}

/** Stok keluar permanen saat barang diterima customer */
export async function consumeStock(tx: Tx, orderId: string, orderNumber: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    await tx.$executeRaw`
      UPDATE stocks SET quantity = quantity - ${it.quantity}, reserved = GREATEST(reserved - ${it.quantity}, 0), "updatedAt" = NOW()
      WHERE "productId" = ${it.productId}`;
    await tx.stockMovement.create({ data: { productId: it.productId, type: 'OUT', quantity: it.quantity, note: `Penjualan ${orderNumber}`, referenceId: orderId } });
    await tx.product.update({ where: { id: it.productId }, data: { soldCount: { increment: it.quantity } } });
  }
}

async function releaseVoucher(tx: Tx, orderId: string) {
  const usage = await tx.voucherUsage.findUnique({ where: { orderId } });
  if (!usage) return;
  await tx.voucherUsage.delete({ where: { orderId } });
  await tx.voucher.update({ where: { id: usage.voucherId }, data: { usedCount: { decrement: 1 } } });
}

function assertCanView(user: AuthUser, order: { userId: string; delivery: { courier: { userId: string } | null } | null }) {
  if (user.role === Role.ADMIN) return;
  if (user.role === Role.CUSTOMER && order.userId === user.id) return;
  if (user.role === Role.COURIER && order.delivery?.courier?.userId === user.id) return;
  throw AppError.notFound('Pesanan tidak ditemukan');
}

export const ordersService = {
  // ------------------------------------------------------------------ checkout
  async checkout(userId: string, input: CheckoutBody, opts: { subscriptionId?: string; clearCart?: boolean } = {}) {
    // 1) item: dari body atau keranjang
    let lines: { productId: string; quantity: number }[];
    const fromCart = !input.items?.length;
    if (!fromCart) {
      const merged = new Map<string, number>();
      for (const it of input.items!) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
      lines = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
    } else {
      const cart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
      if (!cart?.items.length) throw AppError.unprocessable('Keranjang kosong', ErrorCodes.EMPTY_CART);
      lines = cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    }
    lines.sort((a, b) => a.productId.localeCompare(b.productId)); // urutan konsisten -> hindari deadlock

    const orderId = await prisma.$transaction(
      async (tx) => {
        // 2) alamat & zona
        const address = await tx.address.findFirst({ where: { id: input.addressId, userId }, include: { zone: true } });
        if (!address) throw AppError.notFound('Alamat tidak ditemukan');
        const zone = address.zone;
        if (!zone || !zone.isActive) throw AppError.unprocessable('Alamat belum masuk zona pengiriman yang aktif', ErrorCodes.ADDRESS_NOT_IN_ZONE);

        // 3) produk & harga
        const products = await tx.product.findMany({
          where: { id: { in: lines.map((l) => l.productId) }, deletedAt: null, isActive: true },
          include: { priceTiers: true },
        });
        if (products.length !== lines.length) throw AppError.unprocessable('Sebagian produk tidak tersedia');
        const byId = new Map(products.map((p) => [p.id, p]));

        const profile = await tx.customerProfile.findUnique({ where: { userId } });
        let heldRemaining = profile?.gallonsHeld ?? 0;
        let deposit = D(0);
        let emptyToReturn = 0;
        let subtotal = D(0);

        const itemsData = lines.map((l) => {
          const p = byId.get(l.productId)!;
          if (l.quantity < p.minOrderQty) throw AppError.unprocessable(`Minimal pembelian ${p.name}: ${p.minOrderQty}`);
          if (p.maxOrderQty && l.quantity > p.maxOrderQty) throw AppError.unprocessable(`Maksimal pembelian ${p.name}: ${p.maxOrderQty}`);
          const unit = resolveUnitPrice(p, p.priceTiers, l.quantity);
          const line = unit.mul(l.quantity);
          subtotal = subtotal.add(line);

          // Deposit galon:
          //  - isi ulang (requiresEmptyReturn): customer wajib menukar galon kosong. Galon yang dimiliki
          //    menutup kebutuhan; kekurangannya dikenai deposit.
          //  - produk lain dengan depositAmount (mis. galon baru): deposit untuk seluruh qty.
          if (p.requiresEmptyReturn) {
            const covered = Math.min(heldRemaining, l.quantity);
            heldRemaining -= covered;
            emptyToReturn += covered;
            deposit = deposit.add(p.depositAmount.mul(l.quantity - covered));
          } else if (p.depositAmount.gt(0)) {
            deposit = deposit.add(p.depositAmount.mul(l.quantity));
          }
          return { productId: p.id, productName: p.name, sku: p.sku, unitPrice: unit, quantity: l.quantity, depositPerUnit: p.depositAmount, subtotal: line };
        });

        // 4) zona: minimal order & ongkir
        if (subtotal.lt(zone.minOrder)) {
          throw AppError.unprocessable(`Minimal order untuk zona ${zone.name} adalah Rp${zone.minOrder.toFixed(0)}`, ErrorCodes.MIN_ORDER_NOT_MET);
        }
        const shippingFee = zone.freeShippingMin && subtotal.gte(zone.freeShippingMin) ? D(0) : zone.shippingFee;

        // 5) slot pengiriman
        let scheduledDate: Date | undefined;
        if (input.slotId) {
          const slot = await tx.deliverySlot.findFirst({ where: { id: input.slotId, isActive: true } });
          if (!slot) throw AppError.unprocessable('Slot pengiriman tidak tersedia');
          scheduledDate = startOfDay(input.scheduledDate!);
          if (scheduledDate < startOfDay()) throw AppError.unprocessable('Tanggal pengiriman tidak boleh di masa lalu');
          const next = new Date(scheduledDate.getTime() + 86_400_000);
          const taken = await tx.order.count({
            where: { slotId: slot.id, scheduledDate: { gte: scheduledDate, lt: next }, status: { notIn: [S.CANCELLED, S.REFUNDED] } },
          });
          if (taken >= slot.capacity) throw AppError.unprocessable('Slot pengiriman sudah penuh', ErrorCodes.SLOT_FULL);
        } else if (input.scheduledDate) {
          scheduledDate = startOfDay(input.scheduledDate);
        }

        // 6) voucher
        let voucherId: string | undefined;
        let discount = D(0);
        if (input.voucherCode) {
          const r = await validateVoucher(tx, userId, input.voucherCode, subtotal, shippingFee);
          voucherId = r.voucher.id;
          discount = r.discount;
        }

        const serviceFee = D(await settingsService.getNumber(SETTING_KEYS.SERVICE_FEE, 0));
        let total = subtotal.add(shippingFee).add(serviceFee).add(deposit).sub(discount);
        if (total.lt(0)) total = D(0);

        // 7) reservasi stok (atomik; gagal bila available < qty)
        for (const l of lines) {
          const n = await tx.$executeRaw`
            UPDATE stocks SET reserved = reserved + ${l.quantity}, "updatedAt" = NOW()
            WHERE "productId" = ${l.productId} AND quantity - reserved >= ${l.quantity}`;
          if (n === 0) throw AppError.unprocessable(`Stok ${byId.get(l.productId)!.name} tidak mencukupi`, ErrorCodes.OUT_OF_STOCK);
        }

        // 8) buat order
        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId, addressId: address.id, zoneId: zone.id, slotId: input.slotId, voucherId,
            subscriptionId: opts.subscriptionId,
            shippingName: address.recipientName, shippingPhone: address.phone,
            shippingAddress: [address.street, address.detail, address.village, address.district, address.city, address.province, address.postalCode].filter(Boolean).join(', '),
            shippingLat: address.latitude, shippingLng: address.longitude,
            subtotal, shippingFee, discountAmount: discount, depositAmount: deposit, serviceFee, totalAmount: total,
            emptyGallonsToReturn: emptyToReturn, scheduledDate, customerNote: input.customerNote,
            items: { create: itemsData },
            statusHistory: { create: { status: S.PENDING_PAYMENT, note: 'Pesanan dibuat', changedBy: userId } },
            delivery: { create: {} },
          },
        });

        if (voucherId) {
          const v = await tx.voucher.findUniqueOrThrow({ where: { id: voucherId } });
          const upd = await tx.voucher.updateMany({
            where: { id: voucherId, ...(v.usageLimit !== null && { usedCount: { lt: v.usageLimit } }) },
            data: { usedCount: { increment: 1 } },
          });
          if (!upd.count) throw AppError.unprocessable('Kuota voucher sudah habis', ErrorCodes.VOUCHER_INVALID);
          await tx.voucherUsage.create({ data: { voucherId, userId, orderId: order.id } });
        }

        if (fromCart && opts.clearCart !== false) {
          const cart = await tx.cart.findUnique({ where: { userId } });
          if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        }
        return order.id;
      },
      { timeout: 20_000 },
    );

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    await notify({ userId, type: 'ORDER', title: 'Pesanan dibuat', body: `Pesanan ${order.orderNumber} menunggu pembayaran.`, data: { orderId } });
    await notifyAdmins({ type: 'ORDER', title: 'Pesanan baru', body: `Pesanan ${order.orderNumber} masuk (Rp${order.totalAmount.toFixed(0)}).`, data: { orderId } });
    return order;
  },

  // ------------------------------------------------------------------ query
  async list(user: AuthUser, q: OrderQuery) {
    const where: Prisma.OrderWhereInput = {
      ...(user.role === Role.CUSTOMER && { userId: user.id }),
      ...(user.role === Role.COURIER && { delivery: { courier: { userId: user.id } } }),
      ...(user.role === Role.ADMIN && q.userId && { userId: q.userId }),
      ...(q.status && { status: q.status }),
      ...(q.zoneId && { zoneId: q.zoneId }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
      ...(q.search && { OR: [{ orderNumber: { contains: q.search, mode: 'insensitive' } }, { shippingName: { contains: q.search, mode: 'insensitive' } }, { shippingPhone: { contains: q.search } }] }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where, skip, take, orderBy: { [q.sortBy ?? 'createdAt']: q.sortOrder },
        include: { items: true, delivery: { select: { status: true, courierId: true } }, payments: { select: { status: true, method: true, gateway: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      prisma.order.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(user: AuthUser, id: string) {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { orderNumber: id }] },
      include: { ...orderInclude, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    assertCanView(user, order);
    if (user.role !== Role.ADMIN) {
      const { adminNote, user: _u, ...rest } = order;
      return rest;
    }
    return order;
  },

  // ------------------------------------------------------------------ mutations
  async cancel(user: AuthUser, id: string, reason: string) {
    const order = await prisma.order.findUnique({ where: { id }, include: { payments: true, delivery: true } });
    if (!order || (user.role !== Role.ADMIN && order.userId !== user.id)) throw AppError.notFound('Pesanan tidak ditemukan');
    if (user.role === Role.CUSTOMER && order.status !== S.PENDING_PAYMENT) {
      throw AppError.unprocessable('Pesanan hanya dapat dibatalkan sebelum dibayar. Hubungi admin atau ajukan refund.', ErrorCodes.INVALID_STATUS_TRANSITION);
    }
    if (order.payments.some((p) => p.status === 'PAID' || p.status === 'PARTIAL_REFUND')) {
      throw AppError.unprocessable('Pesanan sudah dibayar; proses lewat pengajuan refund', ErrorCodes.INVALID_STATUS_TRANSITION);
    }
    await prisma.$transaction(async (tx) => {
      await transitionOrder(tx, id, S.CANCELLED, { note: reason, changedBy: user.id, data: { cancelReason: reason, cancelledAt: new Date() } });
      await releaseStock(tx, id);
      await releaseVoucher(tx, id);
      await tx.payment.updateMany({ where: { orderId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      if (order.delivery) {
        const courierId = order.delivery.courierId;
        await tx.delivery.delete({ where: { id: order.delivery.id } });
        if (courierId) {
          const active = await tx.delivery.count({ where: { courierId, status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] } } });
          if (!active) await tx.courierProfile.updateMany({ where: { id: courierId, status: 'BUSY' }, data: { status: 'AVAILABLE' } });
        }
      }
    });
    await notify({ userId: order.userId, type: 'ORDER', title: 'Pesanan dibatalkan', body: `Pesanan ${order.orderNumber} dibatalkan: ${reason}`, data: { orderId: id } });
    return prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  },

  async updateStatus(adminId: string, id: string, to: 'PROCESSING' | 'READY_FOR_DELIVERY' | 'COMPLETED', note?: string) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    await prisma.$transaction(async (tx) => {
      if (to === 'COMPLETED') await completeOrder(tx, id, adminId, note);
      else await transitionOrder(tx, id, to, { note, changedBy: adminId });
    });
    await notify({ userId: order.userId, type: 'ORDER', title: 'Status pesanan diperbarui', body: `Pesanan ${order.orderNumber}: ${to}`, data: { orderId: id, status: to } });
    return prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  },

  /** Customer mengonfirmasi pesanan sudah diterima */
  async confirmReceived(userId: string, id: string) {
    const order = await prisma.order.findFirst({ where: { id, userId } });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    await prisma.$transaction((tx) => completeOrder(tx, id, userId, 'Dikonfirmasi diterima oleh customer'));
    return prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  },

  async setAdminNote(id: string, adminNote: string) {
    return prisma.order.update({ where: { id }, data: { adminNote }, select: { id: true, adminNote: true } });
  },

  /** Dipanggil job: selesaikan otomatis pesanan DELIVERED yang tidak dikonfirmasi */
  async autoCompleteDelivered() {
    const hours = await settingsService.getNumber(SETTING_KEYS.AUTO_COMPLETE_HOURS, 48);
    const cutoff = new Date(Date.now() - hours * 3_600_000);
    const due = await prisma.order.findMany({ where: { status: S.DELIVERED, updatedAt: { lt: cutoff } }, select: { id: true } });
    for (const o of due) {
      await prisma.$transaction((tx) => completeOrder(tx, o.id, null, 'Selesai otomatis')).catch((e) => console.error('[auto-complete]', o.id, e));
    }
    return due.length;
  },
};

/** DELIVERED -> COMPLETED + poin loyalitas */
export async function completeOrder(tx: Tx, orderId: string, by: string | null, note?: string) {
  await transitionOrder(tx, orderId, S.COMPLETED, { note, changedBy: by, data: { completedAt: new Date() } });
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const rate = await settingsService.getNumber(SETTING_KEYS.LOYALTY_RATE, 0.0001);
  const points = Math.floor(order.subtotal.toNumber() * rate);
  if (points > 0) await tx.customerProfile.updateMany({ where: { userId: order.userId }, data: { loyaltyPoint: { increment: points } } });
}
