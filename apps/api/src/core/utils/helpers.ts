import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';

export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const ZERO = new Prisma.Decimal(0);

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

export const generateOrderNumber = () => {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
};

export const shortId = () => randomBytes(4).toString('hex');

export const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Hapus field undefined agar aman untuk prisma update */
export const compact = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const omit = <T extends Record<string, unknown>, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> => {
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
};
