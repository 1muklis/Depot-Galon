import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));

export function swaggerRouter(): Router {
  // openapi.yaml dibaca dari src/docs (dev) atau dari folder sumber saat build (dist/config -> ../../src/docs)
  const candidates = [path.resolve(here, '../docs/openapi.yaml'), path.resolve(here, '../../src/docs/openapi.yaml')];
  const file = candidates.find((p) => {
    try { readFileSync(p); return true; } catch { return false; }
  });
  const router = Router();
  if (!file) return router;
  const spec = parse(readFileSync(file, 'utf8'));
  router.get('/openapi.json', (_req, res) => res.json(spec));
  router.use('/', swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: true } }));
  return router;
}
