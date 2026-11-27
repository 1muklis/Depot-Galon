import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { usersController as c } from './users.controller.js';
import { createUserBody, idParam, statusBody, updateUserBody, userQuery } from './users.schema.js';

export const usersRouter = Router();
usersRouter.use(authenticate, authorize(Role.ADMIN));
usersRouter.get('/', validate({ query: userQuery }), c.list);
usersRouter.post('/', validate({ body: createUserBody }), c.create);
usersRouter.get('/:id', validate({ params: idParam }), c.get);
usersRouter.patch('/:id', validate({ params: idParam, body: updateUserBody }), c.update);
usersRouter.patch('/:id/status', validate({ params: idParam, body: statusBody }), c.setStatus);
usersRouter.delete('/:id', validate({ params: idParam }), c.remove);
