import cron from 'node-cron';
import { prisma } from '../database/prisma.js';
import { addDays } from '../core/utils/helpers.js';
import { notifyAdmins } from '../modules/notifications/notifications.service.js';

export async function runNotificationJob() {
  try {
    // peringatan stok menipis (maks. 1x per 12 jam)
    const since = new Date(Date.now() - 12 * 3_600_000);
    const recent = await prisma.notification.count({ where: { type: 'SYSTEM', title: 'Stok menipis', createdAt: { gte: since } } });
    if (!recent) {
      const low = await prisma.$queryRaw<{ name: string; available: number }[]>`
        SELECT p.name, (s.quantity - s.reserved)::int AS available
        FROM stocks s JOIN products p ON p.id = s."productId"
        WHERE p."deletedAt" IS NULL AND p."isActive" = true AND (s.quantity - s.reserved) <= s."minStock"
        ORDER BY available ASC LIMIT 10`;
      if (low.length) await notifyAdmins({ type: 'SYSTEM', title: 'Stok menipis', body: low.map((l) => `${l.name} (${l.available})`).join(', ') });
    }
    // bersihkan notifikasi yang sudah dibaca > 90 hari
    await prisma.notification.deleteMany({ where: { isRead: true, createdAt: { lt: addDays(new Date(), -90) } } });
    // bersihkan token yang sudah tidak berguna
    await prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: addDays(new Date(), -7) } }] } });
    await prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: addDays(new Date(), -1) } } });
  } catch (e) {
    console.error('[job:notification]', e);
  }
}

export const startNotificationJob = () => cron.schedule('0 * * * *', runNotificationJob);
