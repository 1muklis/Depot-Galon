import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72)
  .regex(/[A-Za-z]/, 'Password harus mengandung huruf')
  .regex(/\d/, 'Password harus mengandung angka');

const phone = z.string().regex(/^(\+62|62|0)8\d{7,12}$/, 'Nomor HP Indonesia tidak valid');

export const registerBody = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: phone.optional(),
  password,
});

export const loginBody = z.object({
  /** email atau nomor HP */
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

export const refreshBody = z.object({ refreshToken: z.string().min(10) });
export const forgotBody = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetBody = z.object({ token: z.string().min(10), password });
export const changePasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: password });

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
export { password as passwordSchema, phone as phoneSchema };
