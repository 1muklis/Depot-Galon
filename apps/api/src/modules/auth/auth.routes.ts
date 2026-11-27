import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authLimiter } from '../../middlewares/rate-limiter.js';
import { validate } from '../../middlewares/validate.js';
import { authController as c } from './auth.controller.js';
import { changePasswordBody, forgotBody, loginBody, refreshBody, registerBody, resetBody } from './auth.schema.js';

export const authRouter = Router();
authRouter.post('/register', authLimiter, validate({ body: registerBody }), c.register);
authRouter.post('/login', authLimiter, validate({ body: loginBody }), c.login);
authRouter.post('/refresh', validate({ body: refreshBody }), c.refresh);
authRouter.post('/logout', validate({ body: refreshBody }), c.logout);
authRouter.post('/forgot-password', authLimiter, validate({ body: forgotBody }), c.forgotPassword);
authRouter.post('/reset-password', authLimiter, validate({ body: resetBody }), c.resetPassword);
authRouter.get('/me', authenticate, c.me);
authRouter.post('/logout-all', authenticate, c.logoutAll);
authRouter.post('/change-password', authenticate, validate({ body: changePasswordBody }), c.changePassword);
