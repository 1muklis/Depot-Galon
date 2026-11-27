import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { upload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { paymentsController as c } from './payments.controller.js';
import { createPaymentBody, idParam, paymentQuery, verifyBody } from './payments.schema.js';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);
paymentsRouter.post('/', authorize(Role.CUSTOMER), validate({ body: createPaymentBody }), c.create);
paymentsRouter.get('/', authorize(Role.CUSTOMER, Role.ADMIN), validate({ query: paymentQuery }), c.list);
paymentsRouter.get('/:id', authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam }), c.get);
paymentsRouter.post('/:id/proof', authorize(Role.CUSTOMER), validate({ params: idParam }), upload.single('proof'), c.proof);
paymentsRouter.post('/:id/cancel', authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam }), c.cancel);
paymentsRouter.post('/:id/verify', authorize(Role.ADMIN), validate({ params: idParam, body: verifyBody }), c.verify);
