import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { addressesService as s } from './addresses.service.js';

export const addressesController = {
  list: asyncHandler(async (req, res) => ok(res, await s.list(requireUser(req).id))),
  get: asyncHandler(async (req, res) => ok(res, await s.get(requireUser(req).id, req.params.id!))),
  create: asyncHandler(async (req, res) => created(res, await s.create(requireUser(req).id, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await s.update(requireUser(req).id, req.params.id!, req.body))),
  setDefault: asyncHandler(async (req, res) => ok(res, await s.setDefault(requireUser(req).id, req.params.id!))),
  remove: asyncHandler(async (req, res) => { await s.remove(requireUser(req).id, req.params.id!); noContent(res); }),
};
