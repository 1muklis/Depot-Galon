import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { upload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { deliveriesController as c } from './deliveries.controller.js';
import { assignBody, deliverBody, deliveryQuery, failBody, idParam, locationBody, orderParam, rejectBody } from './deliveries.schema.js';

export const deliveriesRouter = Router();
deliveriesRouter.use(authenticate);

deliveriesRouter.get('/', authorize(Role.ADMIN, Role.COURIER), validate({ query: deliveryQuery }), c.list);
deliveriesRouter.get('/order/:orderId/tracking', validate({ params: orderParam }), c.track);
deliveriesRouter.get('/:id', authorize(Role.ADMIN, Role.COURIER), validate({ params: idParam }), c.get);

// admin
deliveriesRouter.post('/order/:orderId/assign', authorize(Role.ADMIN), validate({ params: orderParam, body: assignBody }), c.assign);
deliveriesRouter.post('/order/:orderId/auto-assign', authorize(Role.ADMIN), validate({ params: orderParam }), c.autoAssign);

// kurir
const courier = authorize(Role.COURIER);
deliveriesRouter.post('/:id/accept', courier, validate({ params: idParam }), c.accept);
deliveriesRouter.post('/:id/reject', courier, validate({ params: idParam, body: rejectBody }), c.reject);
deliveriesRouter.post('/:id/pickup', courier, validate({ params: idParam, body: locationBody }), c.pickup);
deliveriesRouter.post('/:id/on-the-way', courier, validate({ params: idParam, body: locationBody }), c.onTheWay);
deliveriesRouter.post('/:id/arrived', courier, validate({ params: idParam, body: locationBody }), c.arrived);
deliveriesRouter.post('/:id/tracking', courier, validate({ params: idParam, body: locationBody }), c.tracking);
deliveriesRouter.post('/:id/deliver', courier, validate({ params: idParam }), upload.single('proofPhoto'), validate({ body: deliverBody }), c.deliver);
deliveriesRouter.post('/:id/fail', courier, validate({ params: idParam, body: failBody }), c.fail);
