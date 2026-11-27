import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../core/errors/app-error.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** File ditahan di memori lalu disimpan lewat integrations/storage */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(AppError.badRequest('Hanya file JPEG, PNG, atau WebP yang diizinkan'));
    cb(null, true);
  },
});
