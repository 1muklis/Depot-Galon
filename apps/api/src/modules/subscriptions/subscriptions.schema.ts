import { z } from 'zod';
import { PaymentMethod, SubscriptionFrequency, SubscriptionStatus } from '@prisma/client';
import { paginationQuery } from '../../core/utils/pagination.js';

const items = z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(999) })).min(1).max(20)
  .refine((a) => new Set(a.map((i) => i.productId)).size === a.length, { message: 'Produk tidak boleh duplikat' });

const base = z.object({
  addressId: z.string().min(1),
  slotId: z.string().optional(),
  frequency: z.nativeEnum(SubscriptionFrequency),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(), // 0 = Minggu
  dayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  items,
});

const checkDay = (v: { frequency?: SubscriptionFrequency; dayOfWeek?: number; dayOfMonth?: number }, ctx: z.RefinementCtx) => {
  if (v.frequency === 'MONTHLY' && v.dayOfMonth === undefined) ctx.addIssue({ code: 'custom', path: ['dayOfMonth'], message: 'dayOfMonth wajib untuk MONTHLY' });
  if ((v.frequency === 'WEEKLY' || v.frequency === 'BIWEEKLY') && v.dayOfWeek === undefined) ctx.addIssue({ code: 'custom', path: ['dayOfWeek'], message: 'dayOfWeek wajib untuk WEEKLY/BIWEEKLY' });
};

export const createSubscriptionBody = base.superRefine(checkDay);
export const updateSubscriptionBody = base.partial().superRefine(checkDay);
export const pauseBody = z.object({ until: z.coerce.date().optional() });
export const idParam = z.object({ id: z.string().min(1) });
export const subscriptionQuery = paginationQuery.extend({
  status: z.nativeEnum(SubscriptionStatus).optional(),
  userId: z.string().optional(),
});
export type SubscriptionQuery = z.infer<typeof subscriptionQuery>;
export type CreateSubscriptionBody = z.infer<typeof createSubscriptionBody>;
