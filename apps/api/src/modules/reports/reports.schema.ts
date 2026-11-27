import { z } from 'zod';

const range = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const rangeQuery = range;
export const salesQuery = range.extend({ groupBy: z.enum(['day', 'week', 'month']).default('day') });
export const topQuery = range.extend({ limit: z.coerce.number().int().min(1).max(50).default(10) });
export type RangeQuery = z.infer<typeof rangeQuery>;
export type SalesQuery = z.infer<typeof salesQuery>;
export type TopQuery = z.infer<typeof topQuery>;
