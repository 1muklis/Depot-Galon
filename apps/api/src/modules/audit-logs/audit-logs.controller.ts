import { asyncHandler } from '../../core/utils/async-handler.js';
import { ok, paginated } from '../../core/utils/response.js';
import { auditLogsService } from './audit-logs.service.js';
import type { AuditQuery } from './audit-logs.schema.js';

export const auditLogsController = {
  list: asyncHandler(async (req, res) => paginated(res, await auditLogsService.list(req.query as unknown as AuditQuery))),
  get: asyncHandler(async (req, res) => ok(res, await auditLogsService.get(req.params.id!))),
};
