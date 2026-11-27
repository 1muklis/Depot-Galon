import { Router, type RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { z, type ZodTypeAny } from 'zod';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from './async-handler.js';
import { buildMeta, getPagination, paginationQuery } from './pagination.js';
import { noContent, ok, paginated, created } from './response.js';
import { authenticate, optionalAuth } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { upload } from '../../middlewares/upload.js';
import { storage } from '../../integrations/storage/index.js';
import { writeAudit } from '../../modules/audit-logs/audit-logs.service.js';

export interface CrudConfig {
  /** nama model prisma (camelCase), mis. "category" */
  model: string;
  /** nama entity untuk audit log */
  entity: string;
  createSchema: ZodTypeAny;
  updateSchema: ZodTypeAny;
  searchFields?: string[];
  /** field yang boleh difilter dengan equality lewat query string */
  filterFields?: string[];
  include?: Record<string, unknown>;
  defaultOrderBy?: Record<string, 'asc' | 'desc'>;
  /** list/detail dapat diakses publik (tanpa login) */
  publicRead?: boolean;
  /** where tambahan untuk pembacaan publik (mis. hanya isActive) */
  publicWhere?: Record<string, unknown>;
  /** model memiliki kolom deletedAt */
  softDelete?: boolean;
  writeRoles?: Role[];
  /** folder upload; bila diisi tersedia POST /image */
  uploadFolder?: string;
  /** hook sebelum create/update (mis. generate slug) */
  beforeWrite?: (data: any, existing?: any) => Promise<any> | any;
}

const coerce = (v: string) => (v === 'true' ? true : v === 'false' ? false : v);

export function createCrudRouter(cfg: CrudConfig) {
  const delegate = () => (prisma as any)[cfg.model];
  const router = Router();
  const writeRoles = cfg.writeRoles ?? ['ADMIN' as Role];
  const querySchema = paginationQuery.passthrough();

  const baseWhere = (isPublic: boolean) => ({
    ...(cfg.softDelete && { deletedAt: null }),
    ...(isPublic && cfg.publicWhere),
  });

  const list: RequestHandler = asyncHandler(async (req, res) => {
    const q = req.query as any;
    const isPublic = !req.user || (req.user.role !== 'ADMIN');
    const { page, limit, skip, take } = getPagination(q);
    const where: any = { ...baseWhere(isPublic) };
    for (const f of cfg.filterFields ?? []) if (q[f] !== undefined && q[f] !== '') where[f] = coerce(String(q[f]));
    if (q.search && cfg.searchFields?.length) {
      where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } }));
    }
    const orderBy = q.sortBy ? { [q.sortBy]: q.sortOrder } : (cfg.defaultOrderBy ?? { createdAt: 'desc' });
    const [items, total] = await Promise.all([
      delegate().findMany({ where, skip, take, orderBy, include: cfg.include }),
      delegate().count({ where }),
    ]);
    paginated(res, { items, meta: buildMeta(page, limit, total) });
  });

  const get: RequestHandler = asyncHandler(async (req, res) => {
    const isPublic = !req.user || req.user.role !== 'ADMIN';
    const row = await delegate().findFirst({ where: { id: req.params.id, ...baseWhere(isPublic) }, include: cfg.include });
    if (!row) throw AppError.notFound(`${cfg.entity} tidak ditemukan`);
    ok(res, row);
  });

  const create: RequestHandler = asyncHandler(async (req, res) => {
    const data = cfg.beforeWrite ? await cfg.beforeWrite(req.body) : req.body;
    const row = await delegate().create({ data, include: cfg.include });
    await writeAudit({ req, action: 'CREATE', entity: cfg.entity, entityId: row.id, newValue: row });
    created(res, row);
  });

  const update: RequestHandler = asyncHandler(async (req, res) => {
    const existing = await delegate().findFirst({ where: { id: req.params.id, ...baseWhere(false) } });
    if (!existing) throw AppError.notFound(`${cfg.entity} tidak ditemukan`);
    const data = cfg.beforeWrite ? await cfg.beforeWrite(req.body, existing) : req.body;
    const row = await delegate().update({ where: { id: req.params.id }, data, include: cfg.include });
    await writeAudit({ req, action: 'UPDATE', entity: cfg.entity, entityId: row.id, oldValue: existing, newValue: row });
    ok(res, row);
  });

  const remove: RequestHandler = asyncHandler(async (req, res) => {
    const existing = await delegate().findFirst({ where: { id: req.params.id, ...baseWhere(false) } });
    if (!existing) throw AppError.notFound(`${cfg.entity} tidak ditemukan`);
    if (cfg.softDelete) await delegate().update({ where: { id: req.params.id }, data: { deletedAt: new Date(), isActive: false } });
    else await delegate().delete({ where: { id: req.params.id } });
    await writeAudit({ req, action: 'DELETE', entity: cfg.entity, entityId: req.params.id, oldValue: existing });
    noContent(res);
  });

  const idParam = z.object({ id: z.string().min(1) });
  const readGuards: RequestHandler[] = cfg.publicRead ? [] : [authenticate];
  // pembacaan publik tetap mengenali admin bila token dikirim
  if (cfg.publicRead) readGuards.push(optionalAuth);

  router.get('/', ...readGuards, validate({ query: querySchema }), list);
  router.get('/:id', ...readGuards, validate({ params: idParam }), get);

  const write: RequestHandler[] = [authenticate, authorize(...writeRoles)];
  if (cfg.uploadFolder) {
    router.post('/image', ...write, upload.single('image'), asyncHandler(async (req, res) => {
      if (!req.file) throw AppError.badRequest('File "image" wajib diunggah');
      ok(res, { url: await storage.save(req.file, cfg.uploadFolder!) }, 201);
    }));
  }
  router.post('/', ...write, validate({ body: cfg.createSchema }), create);
  router.patch('/:id', ...write, validate({ params: idParam, body: cfg.updateSchema }), update);
  router.delete('/:id', ...write, validate({ params: idParam }), remove);
  return router;
}
