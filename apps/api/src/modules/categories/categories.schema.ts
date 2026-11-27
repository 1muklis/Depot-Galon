import { z } from 'zod';

export const createCategoryBody = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(1000).optional(),
  image: z.string().url().optional(),
  isActive: z.boolean().default(true),
});
export const updateCategoryBody = createCategoryBody.partial();
