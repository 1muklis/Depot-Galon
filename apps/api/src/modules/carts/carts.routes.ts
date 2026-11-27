import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { cartsService as s } from './carts.service.js';
import { addItemBody, itemParam, updateItemBody } from './carts.schema.js';

export const cartsRouter = Router();
cartsRouter.use(authenticate, authorize(Role.CUSTOMER));
cartsRouter.get('/', asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req).id))));
cartsRouter.post('/items', validate({ body: addItemBody }), asyncHandler(async (req, res) => ok(res, await s.addItem(requireUser(req).id, req.body.productId, req.body.quantity), 201)));
cartsRouter.patch('/items/:productId', validate({ params: itemParam, body: updateItemBody }), asyncHandler(async (req, res) => ok(res, await s.setQuantity(requireUser(req).id, req.params.productId!, req.body.quantity))));
cartsRouter.delete('/items/:productId', validate({ params: itemParam }), asyncHandler(async (req, res) => ok(res, await s.removeItem(requireUser(req).id, req.params.productId!))));
cartsRouter.delete('/', asyncHandler(async (req, res) => ok(res, await s.clear(requireUser(req).id))));
