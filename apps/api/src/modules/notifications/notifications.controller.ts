import { asyncHandler } from '../../core/utils/async-handler.js';
import { noContent, ok, paginated } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { notificationsService as s } from './notifications.service.js';
import type { NotificationQuery } from './notifications.schema.js';

export const notificationsController = {
  list: asyncHandler(async (req, res) => paginated(res, await s.list(requireUser(req).id, req.query as unknown as NotificationQuery))),
  unreadCount: asyncHandler(async (req, res) => ok(res, { count: await s.unreadCount(requireUser(req).id) })),
  markRead: asyncHandler(async (req, res) => ok(res, await s.markRead(requireUser(req).id, req.params.id!))),
  markAllRead: asyncHandler(async (req, res) => ok(res, await s.markAllRead(requireUser(req).id))),
  remove: asyncHandler(async (req, res) => { await s.remove(requireUser(req).id, req.params.id!); noContent(res); }),
  broadcast: asyncHandler(async (req, res) => ok(res, await s.broadcast(req.body), 201)),
};
