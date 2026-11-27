import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok, paginated } from '../../core/utils/response.js';
import { AppError } from '../../core/errors/app-error.js';
import { requireUser } from '../../middlewares/authorize.js';
import { storage } from '../../integrations/storage/index.js';
import { profilesService as s } from './profiles.service.js';
import type { CourierQuery } from './profiles.schema.js';

export const profilesController = {
  me: asyncHandler(async (req, res) => ok(res, await s.me(requireUser(req).id))),
  updateMe: asyncHandler(async (req, res) => {
    const u = requireUser(req);
    ok(res, await s.updateMe(u.id, u.role, req.body));
  }),
  avatar: asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('File "avatar" wajib diunggah');
    const url = await storage.save(req.file, 'avatars');
    ok(res, await s.setAvatar(requireUser(req).id, url));
  }),
  courierLocation: asyncHandler(async (req, res) => ok(res, await s.updateCourierLocation(requireUser(req).id, req.body.lat, req.body.lng))),
  courierStatus: asyncHandler(async (req, res) => ok(res, await s.updateCourierStatus(requireUser(req).id, req.body.status))),
  listCouriers: asyncHandler(async (req, res) => paginated(res, await s.listCouriers(req.query as unknown as CourierQuery))),
};
