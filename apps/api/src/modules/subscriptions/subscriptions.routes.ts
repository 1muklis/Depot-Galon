import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, ok, paginated } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { subscriptionsService as s } from './subscriptions.service.js';
import { createSubscriptionBody, idParam, pauseBody, subscriptionQuery, updateSubscriptionBody, type SubscriptionQuery } from './subscriptions.schema.js';

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authenticate);

subscriptionsRouter.get('/', authorize(Role.CUSTOMER, Role.ADMIN), validate({ query: subscriptionQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(requireUser(req), req.query as unknown as SubscriptionQuery))));
subscriptionsRouter.get('/:id', authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req), req.params.id!))));
subscriptionsRouter.post('/', authorize(Role.CUSTOMER), validate({ body: createSubscriptionBody }), asyncHandler(async (req, res) => created(res, await s.create(requireUser(req).id, req.body))));
subscriptionsRouter.patch('/:id', authorize(Role.CUSTOMER), validate({ params: idParam, body: updateSubscriptionBody }), asyncHandler(async (req, res) => ok(res, await s.update(requireUser(req).id, req.params.id!, req.body))));
subscriptionsRouter.post('/:id/pause', authorize(Role.CUSTOMER), validate({ params: idParam, body: pauseBody }), asyncHandler(async (req, res) => ok(res, await s.pause(requireUser(req).id, req.params.id!, req.body.until))));
subscriptionsRouter.post('/:id/resume', authorize(Role.CUSTOMER), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.resume(requireUser(req).id, req.params.id!))));
subscriptionsRouter.post('/:id/cancel', authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.cancel(requireUser(req), req.params.id!))));
