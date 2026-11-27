import { Router } from 'express';
import { GallonMovementType, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { buildMeta, getPagination, paginationQuery } from '../../core/utils/pagination.js';
import { ok, paginated } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';

export const gallonMovementsRouter = Router();
gallonMovementsRouter.use(authenticate);

const query = paginationQuery.extend({
  userId: z.string().optional(),
  type: z.nativeEnum(GallonMovementType).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
const userParam = z.object({ userId: z.string().min(1) });
const refundBody = z.object({
  userId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1000),
  amount: z.coerce.number().min(0).max(999_999_999),
  note: z.string().max(255).optional(),
});

const balanceOf = async (userId: string) => {
  const p = await prisma.customerProfile.findUnique({ where: { userId }, select: { gallonsHeld: true, depositHeld: true } });
  if (!p) throw AppError.notFound('Profil customer tidak ditemukan');
  return p;
};

gallonMovementsRouter.get('/', authorize(Role.CUSTOMER, Role.ADMIN), validate({ query }), asyncHandler(async (req, res) => {
  const u = requireUser(req);
  const q = req.query as unknown as z.infer<typeof query>;
  const where: Prisma.GallonMovementWhereInput = {
    userId: u.role === Role.ADMIN ? q.userId : u.id,
    ...(q.type && { type: q.type }),
    ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
  };
  const { page, limit, skip, take } = getPagination(q);
  const [items, total] = await Promise.all([
    prisma.gallonMovement.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { order: { select: { orderNumber: true } } } }),
    prisma.gallonMovement.count({ where }),
  ]);
  paginated(res, { items, meta: buildMeta(page, limit, total) });
}));

/** Saldo galon & deposit milik customer yang login */
gallonMovementsRouter.get('/balance', authorize(Role.CUSTOMER), asyncHandler(async (req, res) => ok(res, await balanceOf(requireUser(req).id))));
gallonMovementsRouter.get('/balance/:userId', authorize(Role.ADMIN), validate({ params: userParam }), asyncHandler(async (req, res) => ok(res, await balanceOf(req.params.userId!))));

/** Customer mengembalikan galon & deposit dikembalikan (tanpa pemesanan baru) */
gallonMovementsRouter.post('/deposit-refund', authorize(Role.ADMIN), validate({ body: refundBody }), asyncHandler(async (req, res) => {
  const { userId, quantity, amount, note } = req.body;
  const result = await prisma.$transaction(async (tx) => {
    const p = await tx.customerProfile.findUnique({ where: { userId } });
    if (!p) throw AppError.notFound('Profil customer tidak ditemukan');
    if (quantity > p.gallonsHeld) throw AppError.unprocessable(`Customer hanya memegang ${p.gallonsHeld} galon`);
    if (p.depositHeld.lt(amount)) throw AppError.unprocessable(`Deposit tertahan hanya Rp${p.depositHeld.toFixed(0)}`);
    await tx.customerProfile.update({ where: { userId }, data: { gallonsHeld: { decrement: quantity }, depositHeld: { decrement: amount } } });
    await tx.gallonMovement.create({ data: { userId, type: 'COLLECTED_EMPTY', quantity, note: note ?? 'Pengembalian galon' } });
    return tx.gallonMovement.create({ data: { userId, type: 'DEPOSIT_REFUND', quantity, amount, note } });
  });
  await writeAudit({ req, action: 'DEPOSIT_REFUND', entity: 'GallonMovement', entityId: result.id, newValue: req.body });
  ok(res, { movement: result, balance: await balanceOf(userId) }, 201);
}));
