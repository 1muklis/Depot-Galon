import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { ordersController as c } from './orders.controller.js';
import { adminNoteBody, cancelBody, checkoutBody, idParam, orderQuery, statusBody } from './orders.schema.js';

export const ordersRouter = Router();
ordersRouter.use(authenticate);
ordersRouter.post('/', authorize(Role.CUSTOMER), validate({ body: checkoutBody }), c.checkout);
ordersRouter.get('/', validate({ query: orderQuery }), c.list);
ordersRouter.get('/:id', validate({ params: idParam }), c.get);
ordersRouter.post('/:id/cancel', authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam, body: cancelBody }), c.cancel);
ordersRouter.post('/:id/confirm-received', authorize(Role.CUSTOMER), validate({ params: idParam }), c.confirmReceived);
ordersRouter.patch('/:id/status', authorize(Role.ADMIN), validate({ params: idParam, body: statusBody }), c.updateStatus);
ordersRouter.patch('/:id/admin-note', authorize(Role.ADMIN), validate({ params: idParam, body: adminNoteBody }), c.adminNote);
