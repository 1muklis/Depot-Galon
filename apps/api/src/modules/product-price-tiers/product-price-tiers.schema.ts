import { z } from 'zod';

export const productParam = z.object({ productId: z.string().min(1) });
export const tierParam = z.object({ productId: z.string().min(1), tierId: z.string().min(1) });
export const tierBody = z.object({
  minQty: z.coerce.number().int().min(2),
  price: z.coerce.number().min(0).max(999_999_999),
});
export const replaceTiersBody = z.object({ tiers: z.array(tierBody).max(10) }).refine(
  (v) => new Set(v.tiers.map((t) => t.minQty)).size === v.tiers.length,
  { message: 'minQty tidak boleh duplikat', path: ['tiers'] },
);
