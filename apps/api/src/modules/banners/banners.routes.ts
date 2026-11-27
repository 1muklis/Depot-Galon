import { Router } from 'express';
import { prisma } from '../../database/prisma.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok } from '../../core/utils/response.js';
import { createCrudRouter } from '../../core/utils/crud.js';
import { createBannerBody, updateBannerBody } from './banners.schema.js';

/** Banner yang sedang tayang (aktif dan dalam rentang waktu) untuk halaman depan */
const activeRouter = Router();
activeRouter.get('/active', asyncHandler(async (_req, res) => {
  const now = new Date();
  const rows = await prisma.banner.findMany({
    where: {
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { sortOrder: 'asc' },
  });
  ok(res, rows);
}));

export const bannersRouter = Router();
bannersRouter.use(activeRouter);
bannersRouter.use(createCrudRouter({
  model: 'banner',
  entity: 'Banner',
  createSchema: createBannerBody,
  updateSchema: updateBannerBody,
  searchFields: ['title'],
  filterFields: ['isActive'],
  defaultOrderBy: { sortOrder: 'asc' },
  publicRead: true,
  publicWhere: { isActive: true },
  uploadFolder: 'banners',
}));
