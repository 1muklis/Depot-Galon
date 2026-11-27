import type { RequestHandler } from 'express';
import { AppError } from '../core/errors/app-error.js';

export const notFound: RequestHandler = (req, _res, next) =>
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} tidak ditemukan`));
