import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { addressesController as c } from './addresses.controller.js';
import { createAddressBody, idParam, updateAddressBody } from './addresses.schema.js';

export const addressesRouter = Router();
addressesRouter.use(authenticate, authorize(Role.CUSTOMER));
addressesRouter.get('/', c.list);
addressesRouter.post('/', validate({ body: createAddressBody }), c.create);
addressesRouter.get('/:id', validate({ params: idParam }), c.get);
addressesRouter.patch('/:id', validate({ params: idParam, body: updateAddressBody }), c.update);
addressesRouter.patch('/:id/default', validate({ params: idParam }), c.setDefault);
addressesRouter.delete('/:id', validate({ params: idParam }), c.remove);
