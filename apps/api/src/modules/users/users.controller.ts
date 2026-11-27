import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok, paginated } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { usersService as s } from './users.service.js';
import type { UserQuery } from './users.schema.js';

export const usersController = {
  list: asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as UserQuery))),
  get: asyncHandler(async (req, res) => ok(res, await s.get(req.params.id!))),
  create: asyncHandler(async (req, res) => {
    const user = await s.create(req.body);
    await writeAudit({ req, action: 'CREATE', entity: 'User', entityId: user.id, newValue: user });
    created(res, user);
  }),
  update: asyncHandler(async (req, res) => {
    const user = await s.update(req.params.id!, req.body);
    await writeAudit({ req, action: 'UPDATE', entity: 'User', entityId: user.id, newValue: { ...req.body, password: req.body.password ? '***' : undefined } });
    ok(res, user);
  }),
  setStatus: asyncHandler(async (req, res) => {
    const user = await s.setStatus(req.params.id!, req.body.status, requireUser(req).id);
    await writeAudit({ req, action: 'SET_STATUS', entity: 'User', entityId: user.id, newValue: { status: user.status } });
    ok(res, user);
  }),
  remove: asyncHandler(async (req, res) => {
    await s.remove(req.params.id!, requireUser(req).id);
    await writeAudit({ req, action: 'DELETE', entity: 'User', entityId: req.params.id });
    noContent(res);
  }),
};
