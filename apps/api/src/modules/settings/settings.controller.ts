import { asyncHandler } from '../../core/utils/async-handler.js';
import { noContent, ok } from '../../core/utils/response.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { settingsService } from './settings.service.js';

export const settingsController = {
  listPublic: asyncHandler(async (_req, res) => ok(res, await settingsService.listPublic())),
  listAll: asyncHandler(async (_req, res) => ok(res, await settingsService.listAll())),
  get: asyncHandler(async (req, res) => ok(res, await settingsService.getOne(req.params.key!))),
  upsert: asyncHandler(async (req, res) => {
    const key = req.params.key!;
    const before = await settingsService.getOne(key).catch(() => null);
    const row = await settingsService.upsert(key, req.body);
    await writeAudit({ req, action: before ? 'UPDATE' : 'CREATE', entity: 'Setting', entityId: key, oldValue: before, newValue: row.isSecret ? { ...row, value: '********' } : row });
    ok(res, row.isSecret ? { ...row, value: '********' } : row);
  }),
  remove: asyncHandler(async (req, res) => {
    await settingsService.remove(req.params.key!);
    await writeAudit({ req, action: 'DELETE', entity: 'Setting', entityId: req.params.key });
    noContent(res);
  }),
};
