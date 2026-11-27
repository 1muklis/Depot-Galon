import { CourierStatus, DeliveryStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Tx } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { SETTING_KEYS } from '../../core/constants/index.js';
import { D } from '../../core/utils/helpers.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { haversineKm } from '../../integrations/maps/index.js';
import { storage } from '../../integrations/storage/index.js';
import { notify, notifyAdmins } from '../notifications/notifications.service.js';
import { consumeStock, transitionOrder } from '../orders/orders.service.js';
import { collectCodPayment } from '../payments/payments.service.js';
import { settingsService } from '../settings/settings.service.js';
import type { AuthUser } from '../../core/interfaces/index.js';
import type { DeliverBody, DeliveryQuery } from './deliveries.schema.js';

const ACTIVE: DeliveryStatus[] = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'];
const FLOW: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  ASSIGNED: ['ACCEPTED', 'UNASSIGNED'],
  ACCEPTED: ['PICKED_UP', 'UNASSIGNED'],
  PICKED_UP: ['ON_THE_WAY', 'ARRIVED', 'FAILED'],
  ON_THE_WAY: ['ARRIVED', 'FAILED'],
  ARRIVED: ['DELIVERED', 'FAILED'],
};

const include = {
  order: {
    select: {
      id: true, orderNumber: true, status: true, shippingName: true, shippingPhone: true, shippingAddress: true,
      shippingLat: true, shippingLng: true, totalAmount: true, emptyGallonsToReturn: true, scheduledDate: true, customerNote: true, zoneId: true,
      slot: true, items: { select: { productName: true, quantity: true } },
    },
  },
  courier: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } } },
} satisfies Prisma.DeliveryInclude;

const assertFlow = (from: DeliveryStatus, to: DeliveryStatus) => {
  if (!FLOW[from]?.includes(to)) throw AppError.unprocessable(`Status pengiriman tidak dapat berubah dari ${from} ke ${to}`, ErrorCodes.INVALID_STATUS_TRANSITION);
};

async function freeCourierIfIdle(tx: Tx, courierId: string | null | undefined) {
  if (!courierId) return;
  const active = await tx.delivery.count({ where: { courierId, status: { in: ACTIVE } } });
  if (!active) await tx.courierProfile.updateMany({ where: { id: courierId, status: 'BUSY' }, data: { status: 'AVAILABLE' } });
}

async function loadOwned(user: AuthUser, id: string) {
  const d = await prisma.delivery.findUnique({ where: { id }, include: { courier: true, order: true } });
  if (!d || d.courier?.userId !== user.id) throw AppError.notFound('Pengiriman tidak ditemukan');
  return d;
}

export const deliveriesService = {
  async list(user: AuthUser, q: DeliveryQuery) {
    const where: Prisma.DeliveryWhereInput = {
      ...(user.role === Role.COURIER && { courier: { userId: user.id } }),
      ...(user.role === Role.ADMIN && q.courierId && { courierId: q.courierId }),
      ...(q.status && { status: q.status }),
      ...(q.active !== undefined && { status: q.active ? { in: ACTIVE } : { notIn: ACTIVE } }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
      ...(q.search && { order: { OR: [{ orderNumber: { contains: q.search, mode: 'insensitive' } }, { shippingName: { contains: q.search, mode: 'insensitive' } }] } }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.delivery.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include }),
      prisma.delivery.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(user: AuthUser, id: string) {
    const d = await prisma.delivery.findUnique({ where: { id }, include: { ...include, tracking: { orderBy: { createdAt: 'asc' } } } });
    if (!d) throw AppError.notFound('Pengiriman tidak ditemukan');
    if (user.role === Role.COURIER && d.courier?.userId !== user.id) throw AppError.notFound('Pengiriman tidak ditemukan');
    return d;
  },

  /** Pelacakan untuk customer/admin/kurir berdasarkan id pesanan */
  async trackByOrder(user: AuthUser, orderId: string) {
    const d = await prisma.delivery.findFirst({
      where: { orderId },
      include: {
        order: { select: { userId: true, orderNumber: true, status: true, shippingLat: true, shippingLng: true } },
        courier: { select: { userId: true, currentLat: true, currentLng: true, lastLocationAt: true, vehicleType: true, vehiclePlate: true, user: { select: { name: true, phone: true } } } },
        tracking: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!d) throw AppError.notFound('Pengiriman tidak ditemukan');
    const allowed = user.role === Role.ADMIN || (user.role === Role.CUSTOMER && d.order.userId === user.id) || (user.role === Role.COURIER && d.courier?.userId === user.id);
    if (!allowed) throw AppError.notFound('Pengiriman tidak ditemukan');
    const live = ACTIVE.includes(d.status) && d.courier;
    const eta = live && d.courier?.currentLat != null && d.order.shippingLat != null
      ? { distanceKm: haversineKm({ lat: d.courier.currentLat, lng: d.courier.currentLng! }, { lat: d.order.shippingLat, lng: d.order.shippingLng! }) }
      : null;
    return {
      status: d.status, orderNumber: d.order.orderNumber, orderStatus: d.order.status,
      courier: live ? { name: d.courier!.user.name, phone: d.courier!.user.phone, vehicleType: d.courier!.vehicleType, vehiclePlate: d.courier!.vehiclePlate, lat: d.courier!.currentLat, lng: d.courier!.currentLng, lastLocationAt: d.courier!.lastLocationAt } : null,
      eta, timeline: d.tracking,
    };
  },

  // ------------------------------------------------------------------ admin
  async assign(adminId: string, orderId: string, courierProfileId: string) {
    const delivery = await prisma.delivery.findUnique({ where: { orderId }, include: { order: true } });
    if (!delivery) throw AppError.notFound('Pengiriman untuk pesanan ini tidak ditemukan');
    if (!['PAID', 'PROCESSING', 'READY_FOR_DELIVERY'].includes(delivery.order.status)) {
      throw AppError.unprocessable(`Pesanan berstatus ${delivery.order.status} belum/tidak dapat dikirim`, ErrorCodes.INVALID_STATUS_TRANSITION);
    }
    if (!['UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'FAILED'].includes(delivery.status)) throw AppError.unprocessable(`Pengiriman berstatus ${delivery.status} tidak dapat ditugaskan ulang`);

    const courier = await prisma.courierProfile.findUnique({ where: { id: courierProfileId }, include: { user: true, zones: true } });
    if (!courier || courier.user.deletedAt || courier.user.status !== 'ACTIVE') throw AppError.notFound('Kurir tidak ditemukan atau tidak aktif');
    if (courier.status === CourierStatus.OFFLINE) throw AppError.unprocessable('Kurir sedang offline', ErrorCodes.COURIER_UNAVAILABLE);
    if (courier.zones.length && delivery.order.zoneId && !courier.zones.some((z) => z.zoneId === delivery.order.zoneId)) {
      throw AppError.unprocessable('Kurir tidak melayani zona pesanan ini', ErrorCodes.COURIER_UNAVAILABLE);
    }
    const load = await prisma.delivery.count({ where: { courierId: courier.id, status: { in: ACTIVE }, NOT: { id: delivery.id } } });
    if (load >= courier.maxCapacity) throw AppError.unprocessable('Kapasitas kurir penuh', ErrorCodes.COURIER_UNAVAILABLE);

    const fee = D(await settingsService.getNumber(SETTING_KEYS.COURIER_FEE, 0));
    const prev = delivery.courierId;
    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id: delivery.id },
        data: { courierId: courier.id, status: 'ASSIGNED', assignedAt: new Date(), acceptedAt: null, pickedUpAt: null, arrivedAt: null, failureReason: null, courierFee: fee },
      });
      await tx.deliveryTracking.create({ data: { deliveryId: delivery.id, status: 'ASSIGNED', note: `Ditugaskan ke ${courier.user.name}` } });
      if (delivery.order.status === 'PAID') await transitionOrder(tx, orderId, 'PROCESSING', { note: 'Diproses', changedBy: adminId });
      if (delivery.order.status !== 'READY_FOR_DELIVERY') await transitionOrder(tx, orderId, 'READY_FOR_DELIVERY', { note: `Kurir ${courier.user.name} ditugaskan`, changedBy: adminId });
      if (prev && prev !== courier.id) await freeCourierIfIdle(tx, prev);
    });
    await notify({ userId: courier.userId, type: 'DELIVERY', title: 'Tugas pengiriman baru', body: `Pesanan ${delivery.order.orderNumber} ditugaskan kepada Anda.`, data: { deliveryId: delivery.id, orderId } });
    await notify({ userId: delivery.order.userId, type: 'DELIVERY', title: 'Kurir ditugaskan', body: `Pesanan ${delivery.order.orderNumber} akan diantar oleh ${courier.user.name}.`, data: { orderId } });
    return prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id }, include });
  },

  /** Pilih kurir AVAILABLE terbaik: beban paling sedikit, lalu terdekat dengan alamat tujuan */
  async autoAssign(adminId: string, orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw AppError.notFound('Pesanan tidak ditemukan');
    const couriers = await prisma.courierProfile.findMany({
      where: {
        status: CourierStatus.AVAILABLE, user: { status: 'ACTIVE', deletedAt: null },
        OR: [{ zones: { none: {} } }, ...(order.zoneId ? [{ zones: { some: { zoneId: order.zoneId } } }] : [])],
      },
      include: { _count: { select: { deliveries: { where: { status: { in: ACTIVE } } } } } },
    });
    const candidates = couriers.filter((c) => c._count.deliveries < c.maxCapacity);
    if (!candidates.length) throw AppError.unprocessable('Tidak ada kurir yang tersedia', ErrorCodes.COURIER_UNAVAILABLE);
    const dist = (c: (typeof candidates)[number]) =>
      c.currentLat != null && order.shippingLat != null ? haversineKm({ lat: c.currentLat, lng: c.currentLng! }, { lat: order.shippingLat, lng: order.shippingLng! }) : Number.MAX_SAFE_INTEGER;
    candidates.sort((a, b) => a._count.deliveries - b._count.deliveries || dist(a) - dist(b));
    return this.assign(adminId, orderId, candidates[0]!.id);
  },

  // ------------------------------------------------------------------ courier
  async accept(user: AuthUser, id: string) {
    const d = await loadOwned(user, id);
    assertFlow(d.status, 'ACCEPTED');
    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({ where: { id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.deliveryTracking.create({ data: { deliveryId: id, status: 'ACCEPTED' } });
      await tx.courierProfile.update({ where: { id: d.courierId! }, data: { status: 'BUSY' } });
    });
    await notify({ userId: d.order.userId, type: 'DELIVERY', title: 'Kurir menerima tugas', body: `Pesanan ${d.order.orderNumber} segera dijemput kurir.`, data: { orderId: d.orderId } });
    return this.get(user, id);
  },

  async reject(user: AuthUser, id: string, reason?: string) {
    const d = await loadOwned(user, id);
    assertFlow(d.status, 'UNASSIGNED');
    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({ where: { id }, data: { status: 'UNASSIGNED', courierId: null, assignedAt: null, acceptedAt: null } });
      await tx.deliveryTracking.create({ data: { deliveryId: id, status: 'UNASSIGNED', note: `Ditolak kurir${reason ? `: ${reason}` : ''}` } });
      await freeCourierIfIdle(tx, d.courierId);
    });
    await notifyAdmins({ type: 'DELIVERY', title: 'Tugas ditolak kurir', body: `Pesanan ${d.order.orderNumber} perlu ditugaskan ulang.`, data: { orderId: d.orderId } });
    return this.get({ ...user, role: Role.ADMIN }, id);
  },

  async step(user: AuthUser, id: string, to: 'PICKED_UP' | 'ON_THE_WAY' | 'ARRIVED', loc?: { lat?: number; lng?: number; note?: string }) {
    const d = await loadOwned(user, id);
    assertFlow(d.status, to);
    const times = { PICKED_UP: { pickedUpAt: new Date() }, ARRIVED: { arrivedAt: new Date() }, ON_THE_WAY: {} }[to];
    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({ where: { id }, data: { status: to, ...times } });
      await tx.deliveryTracking.create({ data: { deliveryId: id, status: to, latitude: loc?.lat, longitude: loc?.lng, note: loc?.note } });
      if (loc?.lat != null && loc.lng != null) await tx.courierProfile.update({ where: { id: d.courierId! }, data: { currentLat: loc.lat, currentLng: loc.lng, lastLocationAt: new Date() } });
      if (to === 'PICKED_UP') await transitionOrder(tx, d.orderId, 'ON_DELIVERY', { note: 'Pesanan dalam pengantaran', changedBy: user.id });
    });
    const msg = { PICKED_UP: 'sedang diantar', ON_THE_WAY: 'dalam perjalanan', ARRIVED: 'telah tiba di lokasi' }[to];
    await notify({ userId: d.order.userId, type: 'DELIVERY', title: 'Update pengiriman', body: `Pesanan ${d.order.orderNumber} ${msg}.`, data: { orderId: d.orderId, status: to } });
    return this.get(user, id);
  },

  async addTracking(user: AuthUser, id: string, loc: { lat?: number; lng?: number; note?: string }) {
    const d = await loadOwned(user, id);
    if (!ACTIVE.includes(d.status)) throw AppError.unprocessable('Pengiriman tidak aktif');
    if (loc.lat != null && loc.lng != null) await prisma.courierProfile.update({ where: { id: d.courierId! }, data: { currentLat: loc.lat, currentLng: loc.lng, lastLocationAt: new Date() } });
    return prisma.deliveryTracking.create({ data: { deliveryId: id, status: d.status, latitude: loc.lat, longitude: loc.lng, note: loc.note } });
  },

  async deliver(user: AuthUser, id: string, b: DeliverBody, photo?: Express.Multer.File) {
    const d = await loadOwned(user, id);
    assertFlow(d.status, 'DELIVERED');
    if (!photo) throw AppError.badRequest('Foto bukti pengiriman ("proofPhoto") wajib diunggah');
    if (b.emptyGallonsCollected > d.order.emptyGallonsToReturn) throw AppError.unprocessable(`Galon kosong yang ditukar maksimal ${d.order.emptyGallonsToReturn}`);

    const cod = await prisma.payment.findFirst({ where: { orderId: d.orderId, method: 'COD', status: 'PENDING' } });
    if (cod && !b.codCollected) throw AppError.unprocessable('Pesanan COD: konfirmasi uang tunai sudah diterima (codCollected=true)');
    const proofUrl = await storage.save(photo, 'delivery-proofs');

    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({
        where: { id },
        data: {
          status: 'DELIVERED', deliveredAt: new Date(), proofPhoto: proofUrl, receiverName: b.receiverName, receiverSignature: b.receiverSignature,
          deliveryNote: b.deliveryNote, emptyGallonsCollected: b.emptyGallonsCollected, codCollected: !!cod && b.codCollected,
        },
      });
      await tx.deliveryTracking.create({ data: { deliveryId: id, status: 'DELIVERED', note: `Diterima oleh ${b.receiverName}` } });
      if (cod) await collectCodPayment(tx, d.orderId, d.courierId!);

      await transitionOrder(tx, d.orderId, 'DELIVERED', { note: `Diterima oleh ${b.receiverName}`, changedBy: user.id });
      await consumeStock(tx, d.orderId, d.order.orderNumber);

      // pembukuan galon
      const items = await tx.orderItem.findMany({ where: { orderId: d.orderId }, include: { product: { select: { type: true } } } });
      const delivered = items.filter((i) => i.product.type === 'GALON_ISI_ULANG' || i.product.type === 'GALON_BARU').reduce((n, i) => n + i.quantity, 0);
      const uid = d.order.userId;
      if (delivered > 0) await tx.gallonMovement.create({ data: { userId: uid, orderId: d.orderId, type: 'DELIVERED_FULL', quantity: delivered } });
      if (b.emptyGallonsCollected > 0) await tx.gallonMovement.create({ data: { userId: uid, orderId: d.orderId, type: 'COLLECTED_EMPTY', quantity: b.emptyGallonsCollected } });
      if (d.order.depositAmount.gt(0)) await tx.gallonMovement.create({ data: { userId: uid, orderId: d.orderId, type: 'DEPOSIT_PAID', amount: d.order.depositAmount } });
      const profile = await tx.customerProfile.findUnique({ where: { userId: uid } });
      if (profile) {
        await tx.customerProfile.update({
          where: { userId: uid },
          data: { gallonsHeld: Math.max(0, profile.gallonsHeld + delivered - b.emptyGallonsCollected), depositHeld: { increment: d.order.depositAmount } },
        });
      }

      await tx.courierProfile.update({ where: { id: d.courierId! }, data: { totalDelivered: { increment: 1 } } });
      await freeCourierIfIdle(tx, d.courierId);
    });
    await notify({ userId: d.order.userId, type: 'DELIVERY', title: 'Pesanan tiba', body: `Pesanan ${d.order.orderNumber} telah diterima. Terima kasih!`, data: { orderId: d.orderId } });
    return this.get(user, id);
  },

  async fail(user: AuthUser, id: string, reason: string) {
    const d = await loadOwned(user, id);
    assertFlow(d.status, 'FAILED');
    const max = await settingsService.getNumber(SETTING_KEYS.MAX_DELIVERY_ATTEMPTS, 3);
    await prisma.$transaction(async (tx) => {
      await tx.delivery.update({ where: { id }, data: { status: 'FAILED', failureReason: reason, attemptCount: { increment: 1 } } });
      await tx.deliveryTracking.create({ data: { deliveryId: id, status: 'FAILED', note: reason } });
      await transitionOrder(tx, d.orderId, 'READY_FOR_DELIVERY', { note: `Pengiriman gagal: ${reason}`, changedBy: user.id });
      await freeCourierIfIdle(tx, d.courierId);
    });
    const attempts = d.attemptCount + 1;
    await notifyAdmins({ type: 'DELIVERY', title: 'Pengiriman gagal', body: `Pesanan ${d.order.orderNumber} gagal diantar (percobaan ${attempts}/${max}): ${reason}`, data: { orderId: d.orderId, deliveryId: id } });
    await notify({ userId: d.order.userId, type: 'DELIVERY', title: 'Pengiriman gagal', body: `Pengantaran pesanan ${d.order.orderNumber} gagal: ${reason}. Kami akan menjadwalkan ulang.`, data: { orderId: d.orderId } });
    return this.get(user, id);
  },
};
