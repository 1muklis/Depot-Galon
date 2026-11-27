import type { Request } from 'express';
import { asyncHandler } from '../../core/utils/async-handler.js';
import { noContent, ok } from '../../core/utils/response.js';
import { requireUser } from '../../middlewares/authorize.js';
import { writeAudit } from '../audit-logs/audit-logs.service.js';
import { authService as s } from './auth.service.js';

const meta = (req: Request) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

export const authController = {
  register: asyncHandler(async (req, res) => {
    const out = await s.register(req.body, meta(req));
    await writeAudit({ req, userId: out.user.id, action: 'REGISTER', entity: 'User', entityId: out.user.id });
    ok(res, out, 201);
  }),
  login: asyncHandler(async (req, res) => {
    const out = await s.login(req.body, meta(req));
    await writeAudit({ req, userId: out.user.id, action: 'LOGIN', entity: 'User', entityId: out.user.id });
    ok(res, out);
  }),
  refresh: asyncHandler(async (req, res) => ok(res, await s.refresh(req.body.refreshToken, meta(req)))),
  logout: asyncHandler(async (req, res) => { await s.logout(req.body.refreshToken); noContent(res); }),
  logoutAll: asyncHandler(async (req, res) => { await s.logoutAll(requireUser(req).id); noContent(res); }),
  forgotPassword: asyncHandler(async (req, res) => {
    await s.forgotPassword(req.body.email);
    ok(res, { message: 'Jika email terdaftar, tautan reset password telah dikirim' });
  }),
  resetPassword: asyncHandler(async (req, res) => {
    await s.resetPassword(req.body.token, req.body.password);
    ok(res, { message: 'Password berhasil diubah, silakan login kembali' });
  }),
  changePassword: asyncHandler(async (req, res) => {
    const u = requireUser(req);
    await s.changePassword(u.id, req.body.currentPassword, req.body.newPassword);
    await writeAudit({ req, action: 'CHANGE_PASSWORD', entity: 'User', entityId: u.id });
    ok(res, { message: 'Password berhasil diubah, silakan login kembali' });
  }),
  me: asyncHandler(async (req, res) => ok(res, await s.me(requireUser(req).id))),
};
