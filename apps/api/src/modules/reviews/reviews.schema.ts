import { z } from 'zod';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';

export const createReviewBody = z.object({
  orderId: z.string().min(1),
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});
export const updateReviewBody = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).nullable() }).partial();
export const visibilityBody = z.object({ isVisible: z.boolean() });
export const reviewQuery = paginationQuery.extend({
  productId: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  isVisible: boolQuery,
});
export type ReviewQuery = z.infer<typeof reviewQuery>;
export const idParam = z.object({ id: z.string().min(1) });
