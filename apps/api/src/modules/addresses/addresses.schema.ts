import { z } from 'zod';
import { phoneSchema } from '../auth/auth.schema.js';

export const createAddressBody = z.object({
  label: z.string().trim().min(1).max(50),
  recipientName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  street: z.string().trim().min(3).max(255),
  detail: z.string().max(255).optional(),
  village: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  postalCode: z.string().regex(/^\d{5}$/, 'Kode pos 5 digit').optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  zoneId: z.string().optional(),
  isDefault: z.boolean().optional(),
}).refine((v) => (v.latitude === undefined) === (v.longitude === undefined), { message: 'latitude dan longitude harus diisi bersamaan', path: ['latitude'] });

export const updateAddressBody = z.object({
  label: z.string().trim().min(1).max(50),
  recipientName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  street: z.string().trim().min(3).max(255),
  detail: z.string().max(255).nullable(),
  village: z.string().max(100).nullable(),
  district: z.string().max(100).nullable(),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  postalCode: z.string().regex(/^\d{5}$/).nullable(),
  latitude: z.coerce.number().min(-90).max(90).nullable(),
  longitude: z.coerce.number().min(-180).max(180).nullable(),
  zoneId: z.string().nullable(),
}).partial();

export const idParam = z.object({ id: z.string().min(1) });
export type CreateAddressBody = z.infer<typeof createAddressBody>;
export type UpdateAddressBody = z.infer<typeof updateAddressBody>;
