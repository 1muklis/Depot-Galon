import type { Response } from 'express';
import type { PaginationMeta } from '../interfaces/index.js';

export const ok = <T>(res: Response, data: T, status = 200, meta?: PaginationMeta) =>
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = <T>(res: Response, data: T) => ok(res, data, 201);

export const paginated = <T>(res: Response, result: { items: T[]; meta: PaginationMeta }) =>
  ok(res, result.items, 200, result.meta);

export const noContent = (res: Response) => res.status(204).end();
