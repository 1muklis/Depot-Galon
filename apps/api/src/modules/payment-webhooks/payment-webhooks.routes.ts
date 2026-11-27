import { Router, type RequestHandler } from 'express';
import { PaymentGateway, Role } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok, paginated } from '../../core/utils/response.js';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { paymentWebhooksService as s } from './payment-webhooks.service.js';

export const paymentWebhooksRouter = Router();

/** Endpoint publik untuk callback gateway; keabsahan ditentukan oleh signature masing-masing provider */
const receiver = (gateway: PaymentGateway): RequestHandler =>
  asyncHandler(async (req, res) => {
    const r = await s.receive(gateway, req);
    if (!r.valid) return void res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Signature tidak valid' } });
    res.status(200).json({ success: true });
  });

paymentWebhooksRouter.post('/midtrans', receiver('MIDTRANS'));
paymentWebhooksRouter.post('/xendit', receiver('XENDIT'));
paymentWebhooksRouter.post('/doku', receiver('DOKU'));
paymentWebhooksRouter.post('/duitku', receiver('DUITKU'));

// ---- admin: monitoring log
const logQuery = paginationQuery.extend({
  gateway: z.nativeEnum(PaymentGateway).optional(),
  processed: boolQuery,
  isValid: boolQuery,
  externalId: z.string().optional(),
});
const idParam = z.object({ id: z.string().min(1) });

paymentWebhooksRouter.get('/logs', authenticate, authorize(Role.ADMIN), validate({ query: logQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(req.query as any))));
paymentWebhooksRouter.get('/logs/:id', authenticate, authorize(Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.get(req.params.id!))));
paymentWebhooksRouter.post('/logs/:id/reprocess', authenticate, authorize(Role.ADMIN), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.reprocess(req.params.id!))));
