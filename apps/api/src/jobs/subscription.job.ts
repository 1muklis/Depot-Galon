import cron from 'node-cron';
import { subscriptionsService } from '../modules/subscriptions/subscriptions.service.js';

let running = false;

export async function runSubscriptionJob() {
  if (running) return;
  running = true;
  try {
    const r = await subscriptionsService.runDue();
    if (r.due) console.log(`[job:subscription] jatuh tempo=${r.due} dibuat=${r.created}`);
  } catch (e) {
    console.error('[job:subscription]', e);
  } finally {
    running = false;
  }
}

export const startSubscriptionJob = () => cron.schedule('*/5 * * * *', runSubscriptionJob);
