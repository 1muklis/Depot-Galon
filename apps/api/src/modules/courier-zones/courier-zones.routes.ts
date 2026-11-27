import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';

export const courierZonesRouter = Router();
courierZonesRouter.use(authenticate, authorize(Role.ADMIN));

const pair = z.object({ courierId: z.string().min(1), zoneId: z.string().min(1) });
const courierParam = z.object({ courierId: z.string().min(1) });
const replaceBody = z.object({ zoneIds: z.array(z.string().min(1)).max(100) });
const listQuery = z.object({ courierId: z.string().optional(), zoneId: z.string().optional() });

const include = { courier: { include: { user: { select: { id: true, name: true, phone: true } } } }, zone: { select: { id: true, name: true, isActive: true } } };

async function assertBoth(courierId: string, zoneIds: string[]) {
  const courier = await prisma.courierProfile.findUnique({ where: { id: courierId } });
  if (!courier) throw AppError.notFound('Kurir tidak ditemukan (gunakan id profil kurir)');
  const zones = await prisma.deliveryZone.count({ where: { id: { in: zoneIds } } });
  if (zones !== new Set(zoneIds).size) throw AppError.notFound('Sebagian zona tidak ditemukan');
}

courierZonesRouter.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const q = req.query as z.infer<typeof listQuery>;
  ok(res, await prisma.courierZone.findMany({ where: { ...(q.courierId && { courierId: q.courierId }), ...(q.zoneId && { zoneId: q.zoneId }) }, include }));
}));

courierZonesRouter.post('/', validate({ body: pair }), asyncHandler(async (req, res) => {
  await assertBoth(req.body.courierId, [req.body.zoneId]);
  const row = await prisma.courierZone.upsert({ where: { courierId_zoneId: req.body }, create: req.body, update: {}, include });
  await writeAudit({ req, action: 'ASSIGN_ZONE', entity: 'CourierZone', entityId: `${req.body.courierId}:${req.body.zoneId}` });
  created(res, row);
}));

/** Ganti seluruh zona seorang kurir sekaligus */
courierZonesRouter.put('/courier/:courierId', validate({ params: courierParam, body: replaceBody }), asyncHandler(async (req, res) => {
  const courierId = req.params.courierId!;
  const zoneIds = [...new Set<string>(req.body.zoneIds)];
  await assertBoth(courierId, zoneIds);
  const rows = await prisma.$transaction(async (tx) => {
    await tx.courierZone.deleteMany({ where: { courierId } });
    if (zoneIds.length) await tx.courierZone.createMany({ data: zoneIds.map((zoneId) => ({ courierId, zoneId })) });
    return tx.courierZone.findMany({ where: { courierId }, include });
  });
  await writeAudit({ req, action: 'REPLACE_ZONES', entity: 'CourierZone', entityId: courierId, newValue: zoneIds });
  ok(res, rows);
}));

courierZonesRouter.delete('/:courierId/:zoneId', validate({ params: pair }), asyncHandler(async (req, res) => {
  const r = await prisma.courierZone.deleteMany({ where: { courierId: req.params.courierId!, zoneId: req.params.zoneId! } });
  if (!r.count) throw AppError.notFound('Relasi kurir-zona tidak ditemukan');
  await writeAudit({ req, action: 'UNASSIGN_ZONE', entity: 'CourierZone', entityId: `${req.params.courierId}:${req.params.zoneId}` });
  noContent(res);
}));
