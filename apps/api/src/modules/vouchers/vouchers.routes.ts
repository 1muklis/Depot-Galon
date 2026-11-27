import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, ok, paginated } from '../../core/utils/response.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize, requireUser } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { vouchersService as s } from './vouchers.service.js';
import { createVoucherBody, idParam, updateVoucherBody, validateVoucherBody, voucherQuery, type VoucherQuery } from './vouchers.schema.js';

export const vouchersRouter = Router();
vouchersRouter.use(authenticate);

// customer
vouchersRouter.get('/available', authorize(Role.CUSTOMER), asyncHandler(async (req, res) => ok(res, await s.available(requireUser(req).id))));
vouchersRouter.post('/validate', authorize(Role.CUSTOMER), validate({ body: validateVoucherBody }), asyncHandler(async (req, res) => {
  ok(res, await s.check(requireUser(req).id, req.body.code, req.body.subtotal, req.body.shippingFee));
}));

// admin
vouchersRouter.use(authorize(Role.ADMIN));
vouchersRouter.get('/', validate({ query: voucherQuery }), asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as VoucherQuery))));
vouchersRouter.post('/', validate({ body: createVoucherBody }), asyncHandler(async (req, res) => {
  const v = await s.create(req.body);
  await writeAudit({ req, action: 'CREATE', entity: 'Voucher', entityId: v.id, newValue: v });
  created(res, v);
}));
vouchersRouter.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await s.get(req.params.id!))));
vouchersRouter.patch('/:id', validate({ params: idParam, body: updateVoucherBody }), asyncHandler(async (req, res) => {
  const v = await s.update(req.params.id!, req.body);
  await writeAudit({ req, action: 'UPDATE', entity: 'Voucher', entityId: v.id, newValue: req.body });
  ok(res, v);
}));
vouchersRouter.delete('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const r = await s.remove(req.params.id!);
  await writeAudit({ req, action: r.deleted ? 'DELETE' : 'DEACTIVATE', entity: 'Voucher', entityId: req.params.id });
  ok(res, r);
}));
