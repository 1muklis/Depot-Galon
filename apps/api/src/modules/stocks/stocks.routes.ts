import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok, paginated } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { stocksService as s } from './stocks.service.js';
import { productParam, stockQuery, updateStockBody, type StockQuery } from './stocks.schema.js';

/** Perubahan jumlah stok hanya lewat /stock-movements agar selalu ada jejak */
export const stocksRouter = Router();
stocksRouter.use(authenticate, authorize(Role.ADMIN));
stocksRouter.get('/', validate({ query: stockQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as StockQuery))));
stocksRouter.get('/:productId', validate({ params: productParam }), asyncHandler(async (req, res) => ok(res, await s.get(req.params.productId!))));
stocksRouter.patch('/:productId', validate({ params: productParam, body: updateStockBody }), asyncHandler(async (req, res) => {
  const row = await s.updateSettings(req.params.productId!, req.body.minStock);
  await writeAudit({ req, action: 'UPDATE_MIN_STOCK', entity: 'Stock', entityId: req.params.productId, newValue: req.body });
  ok(res, row);
}));
