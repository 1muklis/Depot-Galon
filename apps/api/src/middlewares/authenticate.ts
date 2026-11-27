import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserStatus } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../core/errors/app-error.js';
import { ErrorCodes } from '../core/errors/error-codes.js';
import { verifyAccessToken } from '../core/utils/security.js';

const extractToken = (req: Request) => {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
};

async function resolveUser(token: string) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw AppError.unauthorized('Token kedaluwarsa', ErrorCodes.TOKEN_EXPIRED);
    throw AppError.unauthorized('Token tidak valid');
  }
  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    select: { id: true, role: true, email: true, name: true, status: true },
  });
  if (!user) throw AppError.unauthorized('Pengguna tidak ditemukan');
  if (user.status !== UserStatus.ACTIVE) throw AppError.forbidden('Akun tidak aktif', ErrorCodes.ACCOUNT_INACTIVE);
  return { id: user.id, role: user.role, email: user.email, name: user.name };
}

/** Wajib login */
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized();
    req.user = await resolveUser(token);
    next();
  } catch (e) {
    next(e);
  }
};

/** Login opsional: mengisi req.user bila token valid, tanpa error bila tidak ada */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (token) req.user = await resolveUser(token);
    next();
  } catch (e) {
    next(e);
  }
};
