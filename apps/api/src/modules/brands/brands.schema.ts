import { z } from 'zod';

export const createBrandBody = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  logo: z.string().url().optional(),
  isActive: z.boolean().default(true),
});
export const updateBrandBody = createBrandBody.partial();
