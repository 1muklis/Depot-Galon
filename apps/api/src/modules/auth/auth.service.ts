import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { addDays, addMinutes } from '../../core/utils/helpers.js';
import { comparePassword, hashPassword, randomToken, sha256, signAccessToken } from '../../core/utils/security.js';
import { sendPasswordResetEmail } from '../../integrations/email/index.js';
import type { LoginBody, RegisterBody } from './auth.schema.js';

interface Meta { userAgent?: string; ip?: string }

const publicUser = {
  id: true, name: true, email: true, phone: true, avatar: true, role: true, status: true,
  emailVerifiedAt: true, phoneVerifiedAt: true, lastLoginAt: true, createdAt: true,
} as const;

/** Nomor HP dinormalisasi ke format 08xxxxxxxx agar unik secara konsisten */
export const normalizePhone = (p: string) => p.replace(/^\+62/, '0').replace(/^62/, '0');

async function issueTokens(user: { id: string; role: Role }, meta: Meta) {
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: sha256(refreshToken), // hanya hash yang disimpan
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ip,
      expiresAt: addDays(new Date(), env.REFRESH_TOKEN_DAYS),
    },
  });
  return { accessToken: signAccessToken({ sub: user.id, role: user.role }), refreshToken, tokenType: 'Bearer' as const };
}

export const authService = {
  async register(input: RegisterBody, meta: Meta) {
    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    const dup = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, ...(phone ? [{ phone }] : [])] },
      select: { email: true },
    });
    if (dup) throw AppError.conflict(dup.email === input.email ? 'Email sudah terdaftar' : 'Nomor HP sudah terdaftar');

    const user = await prisma.user.create({
      data: {
        name: input.name, email: input.email, phone,
        password: await hashPassword(input.password),
        role: Role.CUSTOMER,
        customerProfile: { create: {} },
        cart: { create: {} },
      },
      select: publicUser,
    });
    return { user, ...(await issueTokens(user, meta)) };
  },

  async login(input: LoginBody, meta: Meta) {
    const id = input.identifier.trim();
    const isEmail = id.includes('@');
    const user = await prisma.user.findFirst({
      where: { deletedAt: null, ...(isEmail ? { email: id.toLowerCase() } : { phone: normalizePhone(id) }) },
    });
    // pesan sama untuk email salah / password salah agar tidak membocorkan akun
    if (!user || !(await comparePassword(input.password, user.password))) {
      throw AppError.unauthorized('Email/nomor HP atau password salah', ErrorCodes.INVALID_CREDENTIALS);
    }
    if (user.status !== UserStatus.ACTIVE) throw AppError.forbidden('Akun tidak aktif', ErrorCodes.ACCOUNT_INACTIVE);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const { password: _pw, ...safe } = user;
    return { user: safe, ...(await issueTokens(user, meta)) };
  },

  /** Rotasi refresh token; token lama langsung dicabut. Pemakaian ulang token yang sudah dicabut = indikasi pencurian -> cabut semua sesi. */
  async refresh(refreshToken: string, meta: Meta) {
    const row = await prisma.refreshToken.findUnique({ where: { token: sha256(refreshToken) }, include: { user: true } });
    if (!row) throw AppError.unauthorized('Refresh token tidak valid');
    if (row.revokedAt) {
      await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw AppError.unauthorized('Refresh token sudah digunakan');
    }
    if (row.expiresAt < new Date()) throw AppError.unauthorized('Refresh token kedaluwarsa', ErrorCodes.TOKEN_EXPIRED);
    if (row.user.deletedAt || row.user.status !== UserStatus.ACTIVE) throw AppError.forbidden('Akun tidak aktif', ErrorCodes.ACCOUNT_INACTIVE);

    await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return issueTokens(row.user, meta);
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.updateMany({ where: { token: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  },

  async logoutAll(userId: string) {
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null, status: UserStatus.ACTIVE } });
    if (!user) return; // selalu sukses agar email tidak bisa dienumerasi
    const token = randomToken(32);
    await prisma.passwordReset.create({ data: { userId: user.id, token: sha256(token), expiresAt: addMinutes(new Date(), 60) } });
    await sendPasswordResetEmail(user.email, user.name, token);
  },

  async resetPassword(token: string, newPassword: string) {
    const row = await prisma.passwordReset.findUnique({ where: { token: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw AppError.badRequest('Token reset tidak valid atau kedaluwarsa');
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { password: await hashPassword(newPassword) } }),
      prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await comparePassword(currentPassword, user.password))) throw AppError.badRequest('Password saat ini salah');
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  },

  async me(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { ...publicUser, customerProfile: true, courierProfile: true, adminProfile: true },
    });
    if (!user) throw AppError.notFound('Pengguna tidak ditemukan');
    return user;
  },
};
