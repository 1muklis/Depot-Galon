import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { auditLogsController as c } from './audit-logs.controller.js';
import { auditQuery, idParam } from './audit-logs.schema.js';

export const auditLogsRouter = Router();
auditLogsRouter.use(authenticate, authorize(Role.ADMIN));
auditLogsRouter.get('/', validate({ query: auditQuery }), c.list);
auditLogsRouter.get('/:id', validate({ params: idParam }), c.get);
