import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { settingsController as c } from './settings.controller.js';
import { keyParam, upsertSettingBody } from './settings.schema.js';

export const settingsRouter = Router();
settingsRouter.get('/public', c.listPublic);
settingsRouter.use(authenticate, authorize(Role.ADMIN));
settingsRouter.get('/', c.listAll);
settingsRouter.get('/:key', validate({ params: keyParam }), c.get);
settingsRouter.put('/:key', validate({ params: keyParam, body: upsertSettingBody }), c.upsert);
settingsRouter.delete('/:key', validate({ params: keyParam }), c.remove);
