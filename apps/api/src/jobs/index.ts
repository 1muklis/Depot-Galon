import { env } from '../config/env.js';
import { startNotificationJob } from './notification.job.js';
import { startPaymentExpirationJob } from './payment-expiration.job.js';
import { startSubscriptionJob } from './subscription.job.js';

/**
 * Catatan: job berjalan di dalam proses API. Bila API dijalankan lebih dari satu instance,
 * set ENABLE_JOBS=true hanya pada satu instance (atau pindahkan ke worker terpisah).
 */
export function startJobs() {
  if (!env.ENABLE_JOBS) return [];
  const tasks = [startSubscriptionJob(), startPaymentExpirationJob(), startNotificationJob()];
  console.log('⏱  Jobs aktif: subscription, payment-expiration, notification');
  return tasks;
}
