import cron from 'node-cron';
import { prisma } from '../database/prisma.js';
import { SETTING_KEYS } from '../core/constants/index.js';
import { ordersService } from '../modules/orders/orders.service.js';
import { settingsService } from '../modules/settings/settings.service.js';
import type { AuthUser } from '../core/interfaces/index.js';

const SYSTEM: AuthUser = { id: 'system', role: 'ADMIN', email: 'system@local', name: 'System' };
let running = false;

export async function runPaymentExpirationJob() {
  if (running) return;
  running = true;
  try {
    // 1) pembayaran PENDING yang lewat batas waktu -> EXPIRED (COD tidak punya expiry)
    const expired = await prisma.payment.updateMany({ where: { status: 'PENDING', method: { not: 'COD' }, expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });

    // 2) pesanan yang tidak dibayar dalam batas waktu -> dibatalkan, stok & voucher dikembalikan
    const minutes = await settingsService.getNumber(SETTING_KEYS.UNPAID_EXPIRE_MINUTES, 1440);
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const stale = await prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff }, payments: { none: { status: { in: ['PENDING', 'PAID'] } } } },
      select: { id: true },
    });
    for (const o of stale) {
      await ordersService.cancel(SYSTEM, o.id, 'Pembayaran tidak diterima sampai batas waktu').catch((e) => console.error('[job:expiration] cancel', o.id, e));
    }

    // 3) pesanan terkirim yang tidak dikonfirmasi -> selesai otomatis
    const completed = await ordersService.autoCompleteDelivered();
    if (expired.count || stale.length || completed) console.log(`[job:expiration] payment=${expired.count} order=${stale.length} selesai=${completed}`);
  } catch (e) {
    console.error('[job:expiration]', e);
  } finally {
    running = false;
  }
}

export const startPaymentExpirationJob = () => cron.schedule('* * * * *', runPaymentExpirationJob);
