import { Prisma, Voucher, VoucherType } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Db } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';
import { D } from '../../core/utils/helpers.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import type { VoucherQuery } from './vouchers.schema.js';

const invalid = (msg: string) => AppError.unprocessable(msg, ErrorCodes.VOUCHER_INVALID);

export function calcDiscount(v: Pick<Voucher, 'type' | 'value' | 'maxDiscount'>, subtotal: Prisma.Decimal, shippingFee: Prisma.Decimal) {
  let d: Prisma.Decimal;
  switch (v.type) {
    case VoucherType.PERCENTAGE:
      d = subtotal.mul(v.value).div(100);
      break;
    case VoucherType.FIXED_AMOUNT:
      d = v.value;
      break;
    case VoucherType.FREE_SHIPPING:
      d = shippingFee;
      break;
  }
  if (v.maxDiscount && d.gt(v.maxDiscount)) d = v.maxDiscount;
  const cap = v.type === VoucherType.FREE_SHIPPING ? shippingFee : subtotal;
  if (d.gt(cap)) d = cap;
  return d.toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
}

export async function validateVoucher(db: Db, userId: string, code: string, subtotal: Prisma.Decimal, shippingFee: Prisma.Decimal) {
  const now = new Date();
  const v = await db.voucher.findUnique({ where: { code } });
  if (!v || !v.isActive) throw invalid('Voucher tidak ditemukan atau tidak aktif');
  if (v.startsAt > now) throw invalid('Voucher belum berlaku');
  if (v.endsAt < now) throw invalid('Voucher sudah kedaluwarsa');
  if (subtotal.lt(v.minPurchase)) throw invalid(`Minimal belanja Rp${v.minPurchase.toFixed(0)} untuk voucher ini`);
  if (v.usageLimit !== null && v.usedCount >= v.usageLimit) throw invalid('Kuota voucher sudah habis');
  const used = await db.voucherUsage.count({ where: { voucherId: v.id, userId } });
  if (used >= v.perUserLimit) throw invalid('Anda sudah mencapai batas penggunaan voucher ini');
  return { voucher: v, discount: calcDiscount(v, subtotal, shippingFee) };
}

export const vouchersService = {
  async list(q: VoucherQuery) {
    const now = new Date();
    const where: Prisma.VoucherWhereInput = {
      ...(q.type && { type: q.type }),
      ...(q.isActive !== undefined && { isActive: q.isActive }),
      ...(q.current && { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } }),
      ...(q.search && { OR: [{ code: { contains: q.search, mode: 'insensitive' } }, { name: { contains: q.search, mode: 'insensitive' } }] }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.voucher.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.voucher.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  /** Voucher yang masih bisa dipakai customer ini */
  async available(userId: string) {
    const now = new Date();
    const vouchers = await prisma.voucher.findMany({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { endsAt: 'asc' },
    });
    const usage = await prisma.voucherUsage.groupBy({ by: ['voucherId'], where: { userId, voucherId: { in: vouchers.map((v) => v.id) } }, _count: true });
    const usedMap = new Map(usage.map((u) => [u.voucherId, u._count]));
    return vouchers
      .filter((v) => (v.usageLimit === null || v.usedCount < v.usageLimit) && (usedMap.get(v.id) ?? 0) < v.perUserLimit)
      .map(({ usedCount, usageLimit, ...rest }) => rest);
  },

  async check(userId: string, code: string, subtotal: number, shippingFee: number) {
    const { voucher, discount } = await validateVoucher(prisma, userId, code, D(subtotal), D(shippingFee));
    return { code: voucher.code, name: voucher.name, type: voucher.type, discount };
  },

  async get(id: string) {
    const v = await prisma.voucher.findUnique({ where: { id }, include: { _count: { select: { usages: true } } } });
    if (!v) throw AppError.notFound('Voucher tidak ditemukan');
    return v;
  },

  async create(data: Prisma.VoucherUncheckedCreateInput) {
    if (await prisma.voucher.findUnique({ where: { code: data.code } })) throw AppError.conflict('Kode voucher sudah dipakai');
    return prisma.voucher.create({ data });
  },

  async update(id: string, data: Prisma.VoucherUncheckedUpdateInput) {
    await this.get(id);
    return prisma.voucher.update({ where: { id }, data });
  },

  /** Voucher yang sudah pernah dipakai hanya dinonaktifkan agar riwayat order tetap konsisten */
  async remove(id: string) {
    const v = await this.get(id);
    const used = await prisma.order.count({ where: { voucherId: id } });
    if (used) {
      await prisma.voucher.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }
    await prisma.voucher.delete({ where: { id: v.id } });
    return { deleted: true, deactivated: false };
  },
};
