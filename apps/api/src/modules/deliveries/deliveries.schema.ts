import { z } from 'zod';
import { DeliveryStatus } from '@prisma/client';
import { paginationQuery } from '../../core/utils/pagination.js';

export const deliveryQuery = paginationQuery.extend({
  status: z.nativeEnum(DeliveryStatus).optional(),
  courierId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
export type DeliveryQuery = z.infer<typeof deliveryQuery>;

export const idParam = z.object({ id: z.string().min(1) });
export const orderParam = z.object({ orderId: z.string().min(1) });
export const assignBody = z.object({ courierId: z.string().min(1) });
export const locationBody = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  note: z.string().max(255).optional(),
});
export const failBody = z.object({ reason: z.string().trim().min(3).max(255) });
export const rejectBody = z.object({ reason: z.string().trim().min(3).max(255).optional() });

const boolish = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
export const deliverBody = z.object({
  receiverName: z.string().trim().min(2).max(100),
  emptyGallonsCollected: z.coerce.number().int().min(0).default(0),
  codCollected: boolish.default(false),
  deliveryNote: z.string().max(500).optional(),
  receiverSignature: z.string().max(200_000).optional(),
});
export type DeliverBody = z.infer<typeof deliverBody>;
