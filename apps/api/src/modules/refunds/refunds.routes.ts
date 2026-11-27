import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, ok, paginated } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { refundsService as s } from './refunds.service.js';
import { createRefundBody, idParam, processBody, refundQuery, rejectBody, type RefundQuery } from './refunds.schema.js';

export const refundsRouter = Router();
refundsRouter.use(authenticate);

refundsRouter.post('/', authorize(Role.CUSTOMER), validate({ body: createRefundBody }), asyncHandler(async (req, res) => created(res, await s.create(requireUser(req), req.body))));
refundsRouter.get('/', authorize(Role.CUSTOMER, Role.ADMIN), validate({ query: refundQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(requireUser(req), req.query as unknown as RefundQuery))));
refundsRouter.get('/:id', authorize(Role.CUSTOMER, Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req), req.params.id!))));

refundsRouter.post('/:id/approve', authorize(Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => {
  const r = await s.decide(requireUser(req).id, req.params.id!, 'approve');
  await writeAudit({ req, action: 'APPROVE_REFUND', entity: 'Refund', entityId: r.id });
  ok(res, r);
}));
refundsRouter.post('/:id/reject', authorize(Role.ADMIN), validate({ params: idParam, body: rejectBody }), asyncHandler(async (req, res) => {
  const r = await s.decide(requireUser(req).id, req.params.id!, 'reject', req.body.reason);
  await writeAudit({ req, action: 'REJECT_REFUND', entity: 'Refund', entityId: r.id, newValue: req.body });
  ok(res, r);
}));
refundsRouter.post('/:id/process', authorize(Role.ADMIN), validate({ params: idParam, body: processBody }), asyncHandler(async (req, res) => {
  const r = await s.process(requireUser(req).id, req.params.id!, req.body.externalRefundId);
  await writeAudit({ req, action: 'PROCESS_REFUND', entity: 'Refund', entityId: r.id, newValue: req.body });
  ok(res, r);
}));
