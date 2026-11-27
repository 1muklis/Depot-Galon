import { z } from 'zod';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';

export const stockQuery = paginationQuery.extend({
  lowStock: boolQuery,
  categoryId: z.string().optional(),
});
export type StockQuery = z.infer<typeof stockQuery>;
export const productParam = z.object({ productId: z.string().min(1) });
export const updateStockBody = z.object({ minStock: z.coerce.number().int().min(0) });
