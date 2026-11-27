import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';

const cache = new Map<string, { v: string | null; at: number }>();
const TTL = 30_000;

export const settingsService = {
  async get(key: string): Promise<string | null> {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.v;
    const row = await prisma.setting.findUnique({ where: { key } });
    cache.set(key, { v: row?.value ?? null, at: Date.now() });
    return row?.value ?? null;
  },

  async getNumber(key: string, fallback: number) {
    const v = await this.get(key);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  },

  async listPublic() {
    const rows = await prisma.setting.findMany({ where: { isSecret: false }, orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    return rows;
  },

  async listAll() {
    const rows = await prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    return rows.map((r) => (r.isSecret ? { ...r, value: '********' } : r));
  },

  async getOne(key: string, includeSecret = false) {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (!row) throw AppError.notFound('Setting tidak ditemukan');
    return row.isSecret && !includeSecret ? { ...row, value: '********' } : row;
  },

  async upsert(key: string, data: { value: string; group?: string; isSecret?: boolean }) {
    const row = await prisma.setting.upsert({
      where: { key },
      create: { key, value: data.value, group: data.group ?? 'general', isSecret: data.isSecret ?? false },
      update: { value: data.value, ...(data.group && { group: data.group }), ...(data.isSecret !== undefined && { isSecret: data.isSecret }) },
    });
    cache.delete(key);
    return row;
  },

  async remove(key: string) {
    await prisma.setting.delete({ where: { key } });
    cache.delete(key);
  },
};
