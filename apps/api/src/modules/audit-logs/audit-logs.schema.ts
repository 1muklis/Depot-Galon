import { z } from 'zod';
import { paginationQuery } from '../../core/utils/pagination.js';

export const auditQuery = paginationQuery.extend({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditQuery = z.infer<typeof auditQuery>;
export const idParam = z.object({ id: z.string().min(1) });
