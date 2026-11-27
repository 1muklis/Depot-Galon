import { z } from 'zod';
import { CourierStatus } from '@prisma/client';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';
import { phoneSchema } from '../auth/auth.schema.js';

export const updateProfileBody = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema.nullable(),
  // customer
  birthDate: z.coerce.date().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable(),
  // courier
  vehicleType: z.string().max(50).nullable(),
  vehiclePlate: z.string().max(20).nullable(),
  licenseNumber: z.string().max(50).nullable(),
  idCardNumber: z.string().max(32).nullable(),
  // admin
  position: z.string().max(100).nullable(),
}).partial();
export type UpdateProfileBody = z.infer<typeof updateProfileBody>;

export const locationBody = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export const courierStatusBody = z.object({ status: z.nativeEnum(CourierStatus) });

export const courierQuery = paginationQuery.extend({
  status: z.nativeEnum(CourierStatus).optional(),
  zoneId: z.string().optional(),
  available: boolQuery,
});
export type CourierQuery = z.infer<typeof courierQuery>;
