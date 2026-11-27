import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';
import { passwordSchema, phoneSchema } from '../auth/auth.schema.js';

export const userQuery = paginationQuery.extend({
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  includeDeleted: boolQuery,
});
export type UserQuery = z.infer<typeof userQuery>;

export const createUserBody = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
  role: z.nativeEnum(Role),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  // profil opsional sesuai role
  position: z.string().max(100).optional(),
  vehicleType: z.string().max(50).optional(),
  vehiclePlate: z.string().max(20).optional(),
  licenseNumber: z.string().max(50).optional(),
  idCardNumber: z.string().max(32).optional(),
  maxCapacity: z.coerce.number().int().min(1).max(100).optional(),
});
export type CreateUserBody = z.infer<typeof createUserBody>;

export const updateUserBody = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema.nullable(),
  role: z.nativeEnum(Role),
  avatar: z.string().url().nullable(),
  password: passwordSchema,
}).partial();
export type UpdateUserBody = z.infer<typeof updateUserBody>;

export const statusBody = z.object({ status: z.nativeEnum(UserStatus) });
export const idParam = z.object({ id: z.string().min(1) });
