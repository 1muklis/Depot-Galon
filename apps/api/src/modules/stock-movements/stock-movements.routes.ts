import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok, paginated } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { stockMovementsService as s } from './stock-movements.service.js';
import { createMovementBody, movementQuery, type MovementQuery } from './stock-movements.schema.js';

export const stockMovementsRouter = Router();
stockMovementsRouter.use(authenticate, authorize(Role.ADMIN));
stockMovementsRouter.get('/', validate({ query: movementQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as MovementQuery))));
stockMovementsRouter.post('/', validate({ body: createMovementBody }), asyncHandler(async (req, res) => {
  const out = await s.create(requireUser(req).id, req.body);
  await writeAudit({ req, action: `STOCK_${req.body.type}`, entity: 'Stock', entityId: req.body.productId, newValue: out });
  ok(res, out, 201);
}));
