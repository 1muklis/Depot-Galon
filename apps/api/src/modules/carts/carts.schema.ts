import { z } from 'zod';

export const addItemBody = z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(999).default(1) });
export const updateItemBody = z.object({ quantity: z.coerce.number().int().min(0).max(999) });
export const itemParam = z.object({ productId: z.string().min(1) });
