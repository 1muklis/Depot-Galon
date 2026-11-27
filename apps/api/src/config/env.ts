import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET minimal 32 karakter'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET minimal 32 karakter'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),

  CORS_ORIGINS: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),
  ENABLE_DOCS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  ENABLE_JOBS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(5),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Galon <no-reply@example.com>'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  DEFAULT_PAYMENT_GATEWAY: z.enum(['MIDTRANS', 'XENDIT', 'DOKU', 'DUITKU']).default('MIDTRANS'),
  PAYMENT_EXPIRY_MINUTES: z.coerce.number().default(1440),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: bool,
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_CALLBACK_TOKEN: z.string().optional(),
  DOKU_CLIENT_ID: z.string().optional(),
  DOKU_SECRET_KEY: z.string().optional(),
  DOKU_IS_PRODUCTION: bool,
  DUITKU_MERCHANT_CODE: z.string().optional(),
  DUITKU_API_KEY: z.string().optional(),
  DUITKU_IS_PRODUCTION: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Konfigurasi environment tidak valid:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
