import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { paginationQuery } from '../../core/utils/pagination.js';

export const checkoutBody = z.object({
  addressId: z.string().min(1),
  slotId: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  voucherCode: z.string().trim().toUpperCase().optional(),
  customerNote: z.string().max(500).optional(),
  /** Bila kosong, item diambil dari keranjang */
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(999) })).min(1).max(50).optional(),
}).refine((v) => !v.slotId || !!v.scheduledDate, { message: 'scheduledDate wajib diisi bila memilih slot', path: ['scheduledDate'] });
export type CheckoutBody = z.infer<typeof checkoutBody>;

export const orderQuery = paginationQuery.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  userId: z.string().optional(),
  zoneId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount', 'scheduledDate']).optional(),
});
export type OrderQuery = z.infer<typeof orderQuery>;

export const idParam = z.object({ id: z.string().min(1) });
export const cancelBody = z.object({ reason: z.string().trim().min(3).max(255) });
export const statusBody = z.object({
  status: z.enum(['PROCESSING', 'READY_FOR_DELIVERY', 'COMPLETED']),
  note: z.string().max(255).optional(),
});
export const adminNoteBody = z.object({ adminNote: z.string().max(1000) });
