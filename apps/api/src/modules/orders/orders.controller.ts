import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, ok, paginated } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { ordersService as s } from './orders.service.js';
import type { OrderQuery } from './orders.schema.js';

export const ordersController = {
  checkout: asyncHandler(async (req, res) => created(res, await s.checkout(requireUser(req).id, req.body))),
  list: asyncHandler(async (req, res) => paginated(res, await s.list(requireUser(req), req.query as unknown as OrderQuery))),
  get: asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req), req.params.id!))),
  cancel: asyncHandler(async (req, res) => {
    const order = await s.cancel(requireUser(req), req.params.id!, req.body.reason);
    await writeAudit({ req, action: 'CANCEL', entity: 'Order', entityId: order.id, newValue: { reason: req.body.reason } });
    ok(res, order);
  }),
  updateStatus: asyncHandler(async (req, res) => {
    const order = await s.updateStatus(requireUser(req).id, req.params.id!, req.body.status, req.body.note);
    await writeAudit({ req, action: 'UPDATE_STATUS', entity: 'Order', entityId: order.id, newValue: req.body });
    ok(res, order);
  }),
  confirmReceived: asyncHandler(async (req, res) => ok(res, await s.confirmReceived(requireUser(req).id, req.params.id!))),
  adminNote: asyncHandler(async (req, res) => ok(res, await s.setAdminNote(req.params.id!, req.body.adminNote))),
};
