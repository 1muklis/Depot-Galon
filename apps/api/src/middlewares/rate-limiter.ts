import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

const handler = (message: string) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message },
});

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: handler('Terlalu banyak request, coba lagi nanti'),
});

/** Untuk endpoint sensitif: login, register, forgot password */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: handler('Terlalu banyak percobaan, coba lagi dalam 15 menit'),
});
