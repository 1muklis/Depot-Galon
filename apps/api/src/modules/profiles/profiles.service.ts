import { CourierStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { normalizePhone } from '../auth/auth.service.js';
import { authService } from '../auth/auth.service.js';
import type { CourierQuery, UpdateProfileBody } from './profiles.schema.js';

export const profilesService = {
  me: (userId: string) => authService.me(userId),

  async updateMe(userId: string, role: Role, b: UpdateProfileBody) {
    const { name, phone, birthDate, gender, vehicleType, vehiclePlate, licenseNumber, idCardNumber, position } = b;
    if (phone) {
      const dup = await prisma.user.findFirst({ where: { phone: normalizePhone(phone), NOT: { id: userId } } });
      if (dup) throw AppError.conflict('Nomor HP sudah dipakai akun lain');
    }
    await prisma.$transaction(async (tx) => {
      if (name !== undefined || phone !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name }),
            ...(phone !== undefined && { phone: phone ? normalizePhone(phone) : null, phoneVerifiedAt: null }),
          },
        });
      }
      if (role === Role.CUSTOMER) {
        await tx.customerProfile.update({ where: { userId }, data: { ...(birthDate !== undefined && { birthDate }), ...(gender !== undefined && { gender }) } });
      } else if (role === Role.COURIER) {
        await tx.courierProfile.update({
          where: { userId },
          data: {
            ...(vehicleType !== undefined && { vehicleType }), ...(vehiclePlate !== undefined && { vehiclePlate }),
            ...(licenseNumber !== undefined && { licenseNumber }), ...(idCardNumber !== undefined && { idCardNumber }),
          },
        });
      } else if (role === Role.ADMIN && position !== undefined) {
        await tx.adminProfile.upsert({ where: { userId }, create: { userId, position }, update: { position } });
      }
    });
    return authService.me(userId);
  },

  async setAvatar(userId: string, url: string) {
    await prisma.user.update({ where: { id: userId }, data: { avatar: url } });
    return { avatar: url };
  },

  async courierProfileOf(userId: string) {
    const p = await prisma.courierProfile.findUnique({ where: { userId } });
    if (!p) throw AppError.forbidden('Profil kurir tidak ditemukan');
    return p;
  },

  async updateCourierLocation(userId: string, lat: number, lng: number) {
    const p = await this.courierProfileOf(userId);
    const updated = await prisma.courierProfile.update({ where: { id: p.id }, data: { currentLat: lat, currentLng: lng, lastLocationAt: new Date() } });
    // jika sedang mengantar, simpan jejak lokasi pada delivery aktif
    const active = await prisma.delivery.findFirst({ where: { courierId: p.id, status: { in: ['PICKED_UP', 'ON_THE_WAY'] } } });
    if (active) await prisma.deliveryTracking.create({ data: { deliveryId: active.id, status: active.status, latitude: lat, longitude: lng } });
    return { currentLat: updated.currentLat, currentLng: updated.currentLng, lastLocationAt: updated.lastLocationAt };
  },

  async updateCourierStatus(userId: string, status: CourierStatus) {
    const p = await this.courierProfileOf(userId);
    if (status === CourierStatus.OFFLINE) {
      const active = await prisma.delivery.count({ where: { courierId: p.id, status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] } } });
      if (active) throw AppError.unprocessable('Selesaikan pengiriman aktif sebelum offline');
    }
    return prisma.courierProfile.update({ where: { id: p.id }, data: { status } });
  },

  async listCouriers(q: CourierQuery) {
    const where: Prisma.CourierProfileWhereInput = {
      user: { deletedAt: null, status: 'ACTIVE', ...(q.search && { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { phone: { contains: q.search } }] }) },
      ...(q.status && { status: q.status }),
      ...(q.available && { status: CourierStatus.AVAILABLE }),
      ...(q.zoneId && { zones: { some: { zoneId: q.zoneId } } }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.courierProfile.findMany({
        where, skip, take, orderBy: { totalDelivered: 'desc' },
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true, email: true } },
          zones: { include: { zone: { select: { id: true, name: true } } } },
          _count: { select: { deliveries: { where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] } } } } },
        },
      }),
      prisma.courierProfile.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },
};
