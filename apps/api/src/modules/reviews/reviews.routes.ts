import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok, paginated } from '../../core/utils/response.js';
import { authenticate, optionalAuth } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { reviewsService as s } from './reviews.service.js';
import { createReviewBody, idParam, reviewQuery, updateReviewBody, visibilityBody, type ReviewQuery } from './reviews.schema.js';

export const reviewsRouter = Router();

reviewsRouter.get('/', optionalAuth, validate({ query: reviewQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as ReviewQuery, req.user))));
reviewsRouter.get('/mine', authenticate, authorize(Role.CUSTOMER), validate({ query: reviewQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as ReviewQuery, requireUser(req), true))));
reviewsRouter.post('/', authenticate, authorize(Role.CUSTOMER), validate({ body: createReviewBody }), asyncHandler(async (req, res) => created(res, await s.create(requireUser(req).id, req.body))));
reviewsRouter.patch('/:id', authenticate, authorize(Role.CUSTOMER), validate({ params: idParam, body: updateReviewBody }), asyncHandler(async (req, res) => ok(res, await s.update(requireUser(req).id, req.params.id!, req.body))));
reviewsRouter.patch('/:id/visibility', authenticate, authorize(Role.ADMIN), validate({ params: idParam, body: visibilityBody }), asyncHandler(async (req, res) => {
  const r = await s.setVisibility(req.params.id!, req.body.isVisible);
  await writeAudit({ req, action: 'MODERATE_REVIEW', entity: 'Review', entityId: r.id, newValue: req.body });
  ok(res, r);
}));
reviewsRouter.delete('/:id', authenticate, authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => { await s.remove(requireUser(req), req.params.id!); noContent(res); }));
