import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: isProd ? ['error'] : ['warn', 'error'] });

if (!isProd) globalForPrisma.prisma = prisma;

/** Client di dalam prisma.$transaction(async (tx) => ...) */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
export type Db = PrismaClient | Tx;
