import { asyncHandler } from '../../core/utils/async-handler.js';
import { AppError } from '../../core/errors/app-error.js';
import { created, ok, paginated } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { paymentsService as s } from './payments.service.js';
import type { PaymentQuery } from './payments.schema.js';

export const paymentsController = {
  create: asyncHandler(async (req, res) => created(res, await s.create(requireUser(req), req.body))),
  list: asyncHandler(async (req, res) => paginated(res, await s.list(requireUser(req), req.query as unknown as PaymentQuery))),
  get: asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req), req.params.id!))),
  proof: asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('File "proof" wajib diunggah');
    ok(res, await s.uploadProof(requireUser(req), req.params.id!, req.file));
  }),
  verify: asyncHandler(async (req, res) => {
    const out = await s.verifyManual(requireUser(req).id, req.params.id!, req.body.approve, req.body.reason);
    await writeAudit({ req, action: req.body.approve ? 'VERIFY_PAYMENT' : 'REJECT_PAYMENT', entity: 'Payment', entityId: req.params.id, newValue: req.body });
    ok(res, out);
  }),
  cancel: asyncHandler(async (req, res) => ok(res, await s.cancel(requireUser(req), req.params.id!))),
};
