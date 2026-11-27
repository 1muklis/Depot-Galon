import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { notificationsController as c } from './notifications.controller.js';
import { broadcastBody, idParam, notificationQuery } from './notifications.schema.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/', validate({ query: notificationQuery }), c.list);
notificationsRouter.get('/unread-count', c.unreadCount);
notificationsRouter.patch('/read-all', c.markAllRead);
notificationsRouter.post('/broadcast', authorize(Role.ADMIN), validate({ body: broadcastBody }), c.broadcast);
notificationsRouter.patch('/:id/read', validate({ params: idParam }), c.markRead);
notificationsRouter.delete('/:id', validate({ params: idParam }), c.remove);
