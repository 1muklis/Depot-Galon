import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { normalizePhone } from '../auth/auth.service.js';
import type { CreateAddressBody, UpdateAddressBody } from './addresses.schema.js';

const include = { zone: { select: { id: true, name: true, shippingFee: true, minOrder: true, freeShippingMin: true, estimatedMinutes: true } } };

async function assertZone(zoneId?: string | null) {
  if (!zoneId) return;
  const z = await prisma.deliveryZone.findFirst({ where: { id: zoneId, isActive: true } });
  if (!z) throw AppError.unprocessable('Zona pengiriman tidak ditemukan atau tidak aktif', ErrorCodes.ADDRESS_NOT_IN_ZONE);
}

export const addressesService = {
  list: (userId: string) => prisma.address.findMany({ where: { userId }, include, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),

  async get(userId: string, id: string) {
    const a = await prisma.address.findFirst({ where: { id, userId }, include });
    if (!a) throw AppError.notFound('Alamat tidak ditemukan');
    return a;
  },

  async create(userId: string, b: CreateAddressBody) {
    await assertZone(b.zoneId);
    return prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      const makeDefault = b.isDefault || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return tx.address.create({ data: { ...b, phone: normalizePhone(b.phone), userId, isDefault: makeDefault }, include });
    });
  },

  async update(userId: string, id: string, b: UpdateAddressBody) {
    await this.get(userId, id);
    await assertZone(b.zoneId);
    return prisma.address.update({ where: { id }, data: { ...b, ...(b.phone && { phone: normalizePhone(b.phone) }) }, include });
  },

  async setDefault(userId: string, id: string) {
    await this.get(userId, id);
    await prisma.$transaction([
      prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.get(userId, id);
  },

  async remove(userId: string, id: string) {
    const a = await this.get(userId, id);
    const used = await prisma.order.count({ where: { addressId: id } });
    const subs = await prisma.subscription.count({ where: { addressId: id, status: { not: 'CANCELLED' } } });
    if (used || subs) throw AppError.conflict('Alamat dipakai oleh pesanan/langganan dan tidak dapat dihapus');
    await prisma.address.delete({ where: { id } });
    if (a.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  },
};
