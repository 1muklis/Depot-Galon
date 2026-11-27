import { asyncHandler } from '../../core/utils/async-handler.js';
import { created, noContent, ok, paginated } from '../../core/utils/response.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { productsService as s } from './products.service.js';
import type { ProductQuery } from './products.schema.js';

export const productsController = {
  list: asyncHandler(async (req, res) => paginated(res, await s.list(req.query as unknown as ProductQuery, req.user?.role))),
  get: asyncHandler(async (req, res) => ok(res, await s.get(req.params.idOrSlug!, req.user?.role))),
  create: asyncHandler(async (req, res) => {
    const p = await s.create(req.body);
    await writeAudit({ req, action: 'CREATE', entity: 'Product', entityId: p.id, newValue: p });
    created(res, p);
  }),
  update: asyncHandler(async (req, res) => {
    const p = await s.update(req.params.id!, req.body);
    await writeAudit({ req, action: 'UPDATE', entity: 'Product', entityId: p.id, newValue: req.body });
    ok(res, p);
  }),
  remove: asyncHandler(async (req, res) => {
    await s.remove(req.params.id!);
    await writeAudit({ req, action: 'DELETE', entity: 'Product', entityId: req.params.id });
    noContent(res);
  }),
};
