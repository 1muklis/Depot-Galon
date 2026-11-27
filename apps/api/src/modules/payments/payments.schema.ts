import { z } from 'zod';
import { PaymentGateway, PaymentMethod, PaymentStatus } from '@prisma/client';
import { paginationQuery } from '../../core/utils/pagination.js';

export const createPaymentBody = z.object({
  orderId: z.string().min(1),
  method: z.nativeEnum(PaymentMethod),
  /** Kosong = default gateway (online) / MANUAL untuk BANK_TRANSFER / COD untuk COD */
  gateway: z.nativeEnum(PaymentGateway).optional(),
  /** Kode bank / channel (mis. BCA, BNI, atau kode channel Duitku) */
  bankCode: z.string().max(30).optional(),
}).superRefine((v, ctx) => {
  if (v.method === 'COD' && v.gateway && v.gateway !== 'COD') ctx.addIssue({ code: 'custom', path: ['gateway'], message: 'COD harus memakai gateway COD' });
  if (v.gateway === 'COD' && v.method !== 'COD') ctx.addIssue({ code: 'custom', path: ['method'], message: 'Gateway COD hanya untuk metode COD' });
  if (v.gateway === 'MANUAL' && v.method !== 'BANK_TRANSFER') ctx.addIssue({ code: 'custom', path: ['method'], message: 'Pembayaran manual hanya untuk BANK_TRANSFER' });
});
export type CreatePaymentBody = z.infer<typeof createPaymentBody>;

export const paymentQuery = paginationQuery.extend({
  status: z.nativeEnum(PaymentStatus).optional(),
  gateway: z.nativeEnum(PaymentGateway).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  orderId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type PaymentQuery = z.infer<typeof paymentQuery>;

export const idParam = z.object({ id: z.string().min(1) });
export const verifyBody = z.object({ approve: z.boolean(), reason: z.string().max(255).optional() })
  .refine((v) => v.approve || !!v.reason, { message: 'Alasan penolakan wajib diisi', path: ['reason'] });
