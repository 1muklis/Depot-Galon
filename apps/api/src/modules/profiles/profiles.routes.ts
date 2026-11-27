import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { upload } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { profilesController as c } from './profiles.controller.js';
import { courierQuery, courierStatusBody, locationBody, updateProfileBody } from './profiles.schema.js';

export const profilesRouter = Router();
profilesRouter.use(authenticate);
profilesRouter.get('/me', c.me);
profilesRouter.patch('/me', validate({ body: updateProfileBody }), c.updateMe);
profilesRouter.post('/me/avatar', upload.single('avatar'), c.avatar);
profilesRouter.patch('/courier/location', authorize(Role.COURIER), validate({ body: locationBody }), c.courierLocation);
profilesRouter.patch('/courier/status', authorize(Role.COURIER), validate({ body: courierStatusBody }), c.courierStatus);
profilesRouter.get('/couriers', authorize(Role.ADMIN), validate({ query: courierQuery }), c.listCouriers);
