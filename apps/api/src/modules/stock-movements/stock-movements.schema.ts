import { z } from 'zod';
import { StockMovementType } from '@prisma/client';
import { paginationQuery } from '../../core/utils/pagination.js';

export const movementQuery = paginationQuery.extend({
  productId: z.string().optional(),
  type: z.nativeEnum(StockMovementType).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type MovementQuery = z.infer<typeof movementQuery>;

/**
 * IN / RETURN / OUT: quantity positif (arah ditentukan oleh type).
 * ADJUSTMENT: quantity bertanda (+/-) sebagai selisih koreksi.
 */
export const createMovementBody = z.object({
  productId: z.string().min(1),
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().int().refine((n) => n !== 0, 'quantity tidak boleh 0'),
  note: z.string().max(255).optional(),
  referenceId: z.string().max(100).optional(),
}).superRefine((v, ctx) => {
  if (v.type !== 'ADJUSTMENT' && v.quantity < 0) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'quantity harus positif (kecuali ADJUSTMENT)' });
  if (v.type === 'ADJUSTMENT' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Alasan penyesuaian wajib diisi' });
});
