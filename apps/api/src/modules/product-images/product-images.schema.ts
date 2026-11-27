import { z } from 'zod';

export const productParam = z.object({ productId: z.string().min(1) });
export const imageParam = z.object({ productId: z.string().min(1), imageId: z.string().min(1) });
export const addImageUrlBody = z.object({
  url: z.string().url(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export const updateImageBody = z.object({
  isPrimary: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
}).partial();
