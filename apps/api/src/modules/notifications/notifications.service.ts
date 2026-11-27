import { NotificationType, Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Db } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import type { BroadcastBody, NotificationQuery } from './notifications.schema.js';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Notifikasi bersifat best-effort: error ditelan agar tidak menggagalkan transaksi utama */
export async function notify(i: NotifyInput, db: Db = prisma) {
  try {
    await db.notification.create({
      data: { userId: i.userId, type: i.type, title: i.title, body: i.body, data: (i.data ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  } catch (e) {
    console.error('[notification] gagal', e);
  }
}

export async function notifyAdmins(i: Omit<NotifyInput, 'userId'>) {
  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
  if (!admins.length) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, type: i.type, title: i.title, body: i.body, data: (i.data ?? undefined) as Prisma.InputJsonValue | undefined })),
  });
}

export const notificationsService = {
  async list(userId: string, q: NotificationQuery) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(q.isRead !== undefined && { isRead: q.isRead }),
      ...(q.type && { type: q.type }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    return { items, meta: buildMeta(page, limit, total) };
  },

  unreadCount: (userId: string) => prisma.notification.count({ where: { userId, isRead: false } }),

  async markRead(userId: string, id: string) {
    const res = await prisma.notification.updateMany({ where: { id, userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    const row = await prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw AppError.notFound('Notifikasi tidak ditemukan');
    return { ...row, updated: res.count };
  },

  async markAllRead(userId: string) {
    const res = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { updated: res.count };
  },

  async remove(userId: string, id: string) {
    const res = await prisma.notification.deleteMany({ where: { id, userId } });
    if (!res.count) throw AppError.notFound('Notifikasi tidak ditemukan');
  },

  async broadcast(b: BroadcastBody) {
    let userIds = b.userIds;
    if (!userIds?.length) {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE', deletedAt: null, ...(b.role && { role: b.role }) },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }
    const res = await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, type: b.type, title: b.title, body: b.body, data: (b.data ?? undefined) as Prisma.InputJsonValue | undefined })),
    });
    return { sent: res.count };
  },
};
