import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, ok, paginated } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { deliveriesService as s } from './deliveries.service.js';
import type { DeliveryQuery } from './deliveries.schema.js';

export const deliveriesController = {
  list: asyncHandler(async (req, res) => paginated(res, await s.list(requireUser(req), req.query as unknown as DeliveryQuery))),
  get: asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req), req.params.id!))),
  track: asyncHandler(async (req, res) => ok(res, await s.trackByOrder(requireUser(req), req.params.orderId!))),
  assign: asyncHandler(async (req, res) => {
    const d = await s.assign(requireUser(req).id, req.params.orderId!, req.body.courierId);
    await writeAudit({ req, action: 'ASSIGN_COURIER', entity: 'Delivery', entityId: d.id, newValue: req.body });
    ok(res, d);
  }),
  autoAssign: asyncHandler(async (req, res) => {
    const d = await s.autoAssign(requireUser(req).id, req.params.orderId!);
    await writeAudit({ req, action: 'AUTO_ASSIGN_COURIER', entity: 'Delivery', entityId: d.id, newValue: { courierId: d.courierId } });
    ok(res, d);
  }),
  accept: asyncHandler(async (req, res) => ok(res, await s.accept(requireUser(req), req.params.id!))),
  reject: asyncHandler(async (req, res) => ok(res, await s.reject(requireUser(req), req.params.id!, req.body.reason))),
  pickup: asyncHandler(async (req, res) => ok(res, await s.step(requireUser(req), req.params.id!, 'PICKED_UP', req.body))),
  onTheWay: asyncHandler(async (req, res) => ok(res, await s.step(requireUser(req), req.params.id!, 'ON_THE_WAY', req.body))),
  arrived: asyncHandler(async (req, res) => ok(res, await s.step(requireUser(req), req.params.id!, 'ARRIVED', req.body))),
  tracking: asyncHandler(async (req, res) => created(res, await s.addTracking(requireUser(req), req.params.id!, req.body))),
  deliver: asyncHandler(async (req, res) => ok(res, await s.deliver(requireUser(req), req.params.id!, req.body, req.file))),
  fail: asyncHandler(async (req, res) => ok(res, await s.fail(requireUser(req), req.params.id!, req.body.reason))),
};
