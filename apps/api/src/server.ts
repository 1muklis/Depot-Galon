import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { startJobs } from './jobs/index.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`🚀 API berjalan di ${env.APP_URL}${env.API_PREFIX} (docs: ${env.APP_URL}/docs)`);
});
const tasks = startJobs();

async function shutdown(signal: string) {
  console.log(`${signal} diterima, menutup server...`);
  tasks.forEach((t) => t.stop());
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
