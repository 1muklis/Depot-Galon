import { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { hashPassword } from '../../core/utils/security.js';
import { normalizePhone } from '../auth/auth.service.js';
import type { CreateUserBody, UpdateUserBody, UserQuery } from './users.schema.js';

export const userSelect = {
  id: true, name: true, email: true, phone: true, avatar: true, role: true, status: true,
  emailVerifiedAt: true, phoneVerifiedAt: true, lastLoginAt: true, createdAt: true, updatedAt: true, deletedAt: true,
} satisfies Prisma.UserSelect;

export const usersService = {
  async list(q: UserQuery) {
    const where: Prisma.UserWhereInput = {
      ...(!q.includeDeleted && { deletedAt: null }),
      ...(q.role && { role: q.role }),
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
          { phone: { contains: q.search } },
        ],
      }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const allowedSort = ['createdAt', 'name', 'email', 'lastLoginAt'];
    const orderBy = { [allowedSort.includes(q.sortBy ?? '') ? q.sortBy! : 'createdAt']: q.sortOrder };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, orderBy, select: userSelect }),
      prisma.user.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { ...userSelect, customerProfile: true, courierProfile: { include: { zones: { include: { zone: true } } } }, adminProfile: true },
    });
    if (!user) throw AppError.notFound('Pengguna tidak ditemukan');
    return user;
  },

  async create(b: CreateUserBody) {
    const phone = b.phone ? normalizePhone(b.phone) : undefined;
    const dup = await prisma.user.findFirst({ where: { OR: [{ email: b.email }, ...(phone ? [{ phone }] : [])] } });
    if (dup) throw AppError.conflict('Email atau nomor HP sudah terdaftar');

    return prisma.user.create({
      data: {
        name: b.name, email: b.email, phone, role: b.role, status: b.status,
        password: await hashPassword(b.password),
        ...(b.role === Role.CUSTOMER && { customerProfile: { create: {} }, cart: { create: {} } }),
        ...(b.role === Role.ADMIN && { adminProfile: { create: { position: b.position } } }),
        ...(b.role === Role.COURIER && {
          courierProfile: {
            create: {
              vehicleType: b.vehicleType, vehiclePlate: b.vehiclePlate, licenseNumber: b.licenseNumber,
              idCardNumber: b.idCardNumber, ...(b.maxCapacity && { maxCapacity: b.maxCapacity }),
            },
          },
        }),
      },
      select: userSelect,
    });
  },

  async update(id: string, b: UpdateUserBody) {
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Pengguna tidak ditemukan');
    if (b.role && b.role !== existing.role) {
      throw AppError.unprocessable('Role tidak dapat diubah; buat akun baru sesuai role yang diinginkan');
    }
    const { password, phone, ...rest } = b;
    return prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(phone !== undefined && { phone: phone ? normalizePhone(phone) : null }),
        ...(password && { password: await hashPassword(password) }),
      },
      select: userSelect,
    });
  },

  async setStatus(id: string, status: UserStatus, actorId: string) {
    if (id === actorId && status !== UserStatus.ACTIVE) throw AppError.unprocessable('Tidak dapat menonaktifkan akun sendiri');
    const user = await prisma.user.update({ where: { id }, data: { status }, select: userSelect });
    if (status !== UserStatus.ACTIVE) await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    return user;
  },

  async remove(id: string, actorId: string) {
    if (id === actorId) throw AppError.unprocessable('Tidak dapat menghapus akun sendiri');
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Pengguna tidak ditemukan');
    // soft delete; email/phone diberi suffix agar bisa dipakai ulang
    const stamp = Date.now();
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(), status: UserStatus.INACTIVE,
          email: `deleted+${stamp}+${existing.email}`,
          phone: existing.phone ? `del${stamp}-${existing.phone}`.slice(0, 30) : null,
        },
      }),
      prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  },
};
