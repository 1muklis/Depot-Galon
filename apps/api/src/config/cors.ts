import cors from 'cors';
import { env } from './env.js';

const origins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

export const corsMiddleware = cors({
  origin: origins.includes('*') ? true : origins,
  credentials: !origins.includes('*'),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});
