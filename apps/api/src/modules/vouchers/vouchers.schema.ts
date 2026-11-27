import { z } from 'zod';
import { VoucherType } from '@prisma/client';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';

const money = z.coerce.number().min(0).max(999_999_999);

export const voucherQuery = paginationQuery.extend({
  type: z.nativeEnum(VoucherType).optional(),
  isActive: boolQuery,
  current: boolQuery, // hanya yang sedang berlaku
});
export type VoucherQuery = z.infer<typeof voucherQuery>;

const base = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, 'Kode 3-32 karakter: huruf, angka, - atau _'),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(VoucherType),
  value: money,
  maxDiscount: money.nullable().optional(),
  minPurchase: money.default(0),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(1).default(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().default(true),
});

export const createVoucherBody = base
  .refine((v) => v.startsAt < v.endsAt, { message: 'startsAt harus sebelum endsAt', path: ['endsAt'] })
  .refine((v) => v.type !== 'PERCENTAGE' || (v.value > 0 && v.value <= 100), { message: 'Persentase 1-100', path: ['value'] });

export const updateVoucherBody = base.partial().omit({ code: true });
export const validateVoucherBody = z.object({
  code: z.string().trim().toUpperCase().min(1),
  subtotal: money,
  shippingFee: money.default(0),
});
export const idParam = z.object({ id: z.string().min(1) });
