import { z } from 'zod';

const money = z.coerce.number().min(0).max(999_999_999);

export const createZoneBody = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  shippingFee: money,
  minOrder: money.default(0),
  freeShippingMin: money.nullable().optional(),
  estimatedMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  isActive: z.boolean().default(true),
});
export const updateZoneBody = createZoneBody.partial();
