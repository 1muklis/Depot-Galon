import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../core/errors/app-error.js';
import { ErrorCodes } from '../core/errors/error-codes.js';
import { isProd } from '../config/env.js';

const body = (code: string, message: string, details?: unknown) => ({
  success: false,
  error: { code, message, ...(details !== undefined ? { details } : {}) },
});

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(body(err.code, err.message, err.details));
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return res.status(422).json(body(ErrorCodes.VALIDATION_ERROR, 'Validasi gagal', details));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return res.status(409).json(body(ErrorCodes.CONFLICT, 'Data sudah ada (duplikat)', { fields: err.meta?.target }));
      case 'P2025':
        return res.status(404).json(body(ErrorCodes.NOT_FOUND, 'Data tidak ditemukan'));
      case 'P2003':
        return res.status(409).json(body(ErrorCodes.CONFLICT, 'Data masih dipakai oleh data lain atau referensi tidak valid'));
    }
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json(body(ErrorCodes.BAD_REQUEST, `Upload gagal: ${err.message}`));
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json(body(ErrorCodes.BAD_REQUEST, 'JSON tidak valid'));
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  return res
    .status(500)
    .json(body(ErrorCodes.INTERNAL, isProd ? 'Terjadi kesalahan pada server' : String(err?.message ?? err)));
};
