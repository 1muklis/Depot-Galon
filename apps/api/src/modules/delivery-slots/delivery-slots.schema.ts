import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam HH:mm');

export const createSlotBody = z
  .object({
    label: z.string().min(2).max(50),
    startTime: time,
    endTime: time,
    capacity: z.coerce.number().int().min(1).max(10_000).default(50),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.startTime < v.endTime, { message: 'startTime harus lebih awal dari endTime', path: ['endTime'] });

export const updateSlotBody = z
  .object({
    label: z.string().min(2).max(50),
    startTime: time,
    endTime: time,
    capacity: z.coerce.number().int().min(1).max(10_000),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => !v.startTime || !v.endTime || v.startTime < v.endTime, { message: 'startTime harus lebih awal dari endTime', path: ['endTime'] });
