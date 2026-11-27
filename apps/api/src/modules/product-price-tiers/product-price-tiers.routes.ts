import { Router } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { productParam, replaceTiersBody, tierBody, tierParam } from './product-price-tiers.schema.js';

/** Dipasang di /products/:productId/price-tiers */
export const productPriceTiersRouter = Router({ mergeParams: true });

const assertProduct = async (productId: string) => {
  const p = await prisma.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true, price: true } });
  if (!p) throw AppError.notFound('Produk tidak ditemukan');
  return p;
};

productPriceTiersRouter.get('/', validate({ params: productParam }), asyncHandler(async (req, res) => {
  await assertProduct(req.params.productId!);
  ok(res, await prisma.productPriceTier.findMany({ where: { productId: req.params.productId! }, orderBy: { minQty: 'asc' } }));
}));

productPriceTiersRouter.use(authenticate, authorize(Role.ADMIN));

productPriceTiersRouter.post('/', validate({ params: productParam, body: tierBody }), asyncHandler(async (req, res) => {
  const p = await assertProduct(req.params.productId!);
  if (p.price.lt(req.body.price) === true) throw AppError.unprocessable('Harga tier tidak boleh lebih tinggi dari harga normal');
  const row = await prisma.productPriceTier.create({ data: { productId: p.id, ...req.body } });
  await writeAudit({ req, action: 'ADD_TIER', entity: 'Product', entityId: p.id, newValue: row });
  created(res, row);
}));

/** Ganti seluruh tier sekaligus (atomik) */
productPriceTiersRouter.put('/', validate({ params: productParam, body: replaceTiersBody }), asyncHandler(async (req, res) => {
  const p = await assertProduct(req.params.productId!);
  if (req.body.tiers.some((t: { price: number }) => p.price.lt(t.price))) throw AppError.unprocessable('Harga tier tidak boleh lebih tinggi dari harga normal');
  const rows = await prisma.$transaction(async (tx) => {
    await tx.productPriceTier.deleteMany({ where: { productId: p.id } });
    await tx.productPriceTier.createMany({ data: req.body.tiers.map((t: { minQty: number; price: number }) => ({ productId: p.id, ...t })) });
    return tx.productPriceTier.findMany({ where: { productId: p.id }, orderBy: { minQty: 'asc' } });
  });
  await writeAudit({ req, action: 'REPLACE_TIERS', entity: 'Product', entityId: p.id, newValue: rows });
  ok(res, rows);
}));

productPriceTiersRouter.patch('/:tierId', validate({ params: tierParam, body: tierBody.partial() }), asyncHandler(async (req, res) => {
  const tier = await prisma.productPriceTier.findFirst({ where: { id: req.params.tierId!, productId: req.params.productId! } });
  if (!tier) throw AppError.notFound('Tier tidak ditemukan');
  ok(res, await prisma.productPriceTier.update({ where: { id: tier.id }, data: req.body }));
}));

productPriceTiersRouter.delete('/:tierId', validate({ params: tierParam }), asyncHandler(async (req, res) => {
  const r = await prisma.productPriceTier.deleteMany({ where: { id: req.params.tierId!, productId: req.params.productId! } });
  if (!r.count) throw AppError.notFound('Tier tidak ditemukan');
  noContent(res);
}));
