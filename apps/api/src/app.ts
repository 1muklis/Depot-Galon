import express from 'express';
import morgan from 'morgan';
import { corsMiddleware } from './config/cors.js';
import { env, isTest } from './config/env.js';
import { helmetMiddleware } from './config/helmet.js';
import { swaggerRouter } from './config/swagger.js';
import { storage } from './integrations/storage/index.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { globalLimiter } from './middlewares/rate-limiter.js';
import { routes } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  if (!isTest) app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(globalLimiter);

  // rawBody dibutuhkan untuk verifikasi signature webhook (mis. DOKU)
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; } }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' })); // callback Duitku

  app.use('/uploads', express.static(storage.rootDir, { maxAge: '7d', index: false }));
  app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } }));
  if (env.ENABLE_DOCS) app.use('/docs', swaggerRouter());

  app.use(env.API_PREFIX, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
