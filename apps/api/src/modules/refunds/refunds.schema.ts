import { z } from 'zod';
import { RefundStatus } from '@prisma/client';
import { paginationQuery } from '../../core/utils/pagination.js';

export const createRefundBody = z.object({
  orderId: z.string().min(1),
  /** Kosong = seluruh sisa yang dapat direfund */
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(5).max(500),
});
export const refundQuery = paginationQuery.extend({
  status: z.nativeEnum(RefundStatus).optional(),
  orderId: z.string().optional(),
});
export type RefundQuery = z.infer<typeof refundQuery>;
export const idParam = z.object({ id: z.string().min(1) });
export const rejectBody = z.object({ reason: z.string().trim().min(3).max(255) });
export const processBody = z.object({ externalRefundId: z.string().max(100).optional() });
