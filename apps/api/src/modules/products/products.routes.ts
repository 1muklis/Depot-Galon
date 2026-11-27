import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, optionalAuth } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { productsController as c } from './products.controller.js';
import { createProductBody, idOrSlugParam, idParam, productQuery, updateProductBody } from './products.schema.js';

export const productsRouter = Router();
productsRouter.get('/', optionalAuth, validate({ query: productQuery }), c.list);
productsRouter.get('/:idOrSlug', optionalAuth, validate({ params: idOrSlugParam }), c.get);
productsRouter.post('/', authenticate, authorize(Role.ADMIN), validate({ body: createProductBody }), c.create);
productsRouter.patch('/:id', authenticate, authorize(Role.ADMIN), validate({ params: idParam, body: updateProductBody }), c.update);
productsRouter.delete('/:id', authenticate, authorize(Role.ADMIN), validate({ params: idParam }), c.remove);
