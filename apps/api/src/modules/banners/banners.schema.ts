import { z } from 'zod';

export const createBannerBody = z.object({
  title: z.string().min(1).max(150),
  image: z.string().url(),
  link: z.string().max(500).optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
}).refine((v) => !v.startsAt || !v.endsAt || v.startsAt < v.endsAt, { message: 'startsAt harus sebelum endsAt', path: ['endsAt'] });

export const updateBannerBody = z.object({
  title: z.string().min(1).max(150),
  image: z.string().url(),
  link: z.string().max(500).nullable(),
  sortOrder: z.coerce.number().int(),
  isActive: z.boolean(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
}).partial();
