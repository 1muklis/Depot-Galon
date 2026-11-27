import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import type { AuditQuery } from './audit-logs.schema.js';

interface AuditInput {
  req?: Request;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

const toJson = (v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.JsonNull;
  // JSON round-trip: mengubah Decimal/Date menjadi string yang aman
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
};

/** Audit tidak boleh menggagalkan operasi utama */
export async function writeAudit(i: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: i.userId ?? i.req?.user?.id ?? null,
        action: i.action,
        entity: i.entity,
        entityId: i.entityId ?? null,
        oldValue: toJson(i.oldValue),
        newValue: toJson(i.newValue),
        ipAddress: i.req?.ip,
        userAgent: i.req?.headers['user-agent']?.slice(0, 255),
      },
    });
  } catch (e) {
    console.error('[audit] gagal menulis log', e);
  }
}

export const auditLogsService = {
  async list(q: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.entity && { entity: q.entity }),
      ...(q.entityId && { entityId: q.entityId }),
      ...(q.userId && { userId: q.userId }),
      ...(q.action && { action: { contains: q.action, mode: 'insensitive' } }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(id: string) {
    const row = await prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!row) throw AppError.notFound('Audit log tidak ditemukan');
    return row;
  },
};
