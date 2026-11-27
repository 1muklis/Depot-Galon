import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { REVENUE_STATUSES } from '../../core/constants/index.js';
import { addDays, startOfDay } from '../../core/utils/helpers.js';
import type { RangeQuery, SalesQuery, TopQuery } from './reports.schema.js';

const statusList = Prisma.join(REVENUE_STATUSES);

/** Default: 30 hari terakhir */
const range = (q: RangeQuery) => ({ from: q.from ?? addDays(startOfDay(), -30), to: q.to ?? new Date() });

export const reportsService = {
  async dashboard() {
    const today = startOfDay();
    const [ordersToday, revenueToday, pendingPayments, pendingRefunds, unassigned, activeDeliveries, onlineCouriers, byStatus, lowStock] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({ where: { createdAt: { gte: today }, status: { in: REVENUE_STATUSES } }, _sum: { totalAmount: true } }),
      prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.refund.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
      prisma.delivery.count({ where: { status: 'UNASSIGNED', order: { status: { in: ['PAID', 'PROCESSING', 'READY_FOR_DELIVERY'] } } } }),
      prisma.delivery.count({ where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] } } }),
      prisma.courierProfile.count({ where: { status: { not: 'OFFLINE' } } }),
      prisma.order.groupBy({ by: ['status'], _count: true }),
      prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM stocks s JOIN products p ON p.id = s."productId" WHERE p."deletedAt" IS NULL AND (s.quantity - s.reserved) <= s."minStock"`,
    ]);
    return {
      ordersToday,
      revenueToday: revenueToday._sum.totalAmount ?? 0,
      pendingPayments, pendingRefunds, unassignedDeliveries: unassigned, activeDeliveries, onlineCouriers,
      lowStockProducts: lowStock[0]?.n ?? 0,
      ordersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    };
  },

  async sales(q: SalesQuery) {
    const { from, to } = range(q);
    const rows = await prisma.$queryRaw<{ period: Date; orders: number; revenue: number; subtotal: number; shipping: number; discount: number }[]>`
      SELECT date_trunc(${q.groupBy}, "createdAt") AS period,
             COUNT(*)::int AS orders,
             COALESCE(SUM("totalAmount"), 0)::float8 AS revenue,
             COALESCE(SUM("subtotal"), 0)::float8 AS subtotal,
             COALESCE(SUM("shippingFee"), 0)::float8 AS shipping,
             COALESCE(SUM("discountAmount"), 0)::float8 AS discount
      FROM orders
      WHERE "createdAt" BETWEEN ${from} AND ${to} AND status::text IN (${statusList})
      GROUP BY 1 ORDER BY 1`;
    const total = rows.reduce((a, r) => ({ orders: a.orders + r.orders, revenue: a.revenue + r.revenue }), { orders: 0, revenue: 0 });
    return { from, to, groupBy: q.groupBy, total, series: rows };
  },

  async topProducts(q: TopQuery) {
    const { from, to } = range(q);
    return prisma.$queryRaw<{ productId: string; name: string; sku: string; quantity: number; revenue: number }[]>`
      SELECT oi."productId", oi."productName" AS name, oi.sku, SUM(oi.quantity)::int AS quantity, SUM(oi.subtotal)::float8 AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi."orderId"
      WHERE o."createdAt" BETWEEN ${from} AND ${to} AND o.status::text IN (${statusList})
      GROUP BY oi."productId", oi."productName", oi.sku
      ORDER BY quantity DESC LIMIT ${q.limit}`;
  },

  async topCustomers(q: TopQuery) {
    const { from, to } = range(q);
    return prisma.$queryRaw<{ userId: string; name: string; email: string; orders: number; spent: number }[]>`
      SELECT u.id AS "userId", u.name, u.email, COUNT(*)::int AS orders, SUM(o."totalAmount")::float8 AS spent
      FROM orders o JOIN users u ON u.id = o."userId"
      WHERE o."createdAt" BETWEEN ${from} AND ${to} AND o.status::text IN (${statusList})
      GROUP BY u.id, u.name, u.email ORDER BY spent DESC LIMIT ${q.limit}`;
  },

  async payments(q: RangeQuery) {
    const { from, to } = range(q);
    const [byGateway, byMethod, byStatus] = await Promise.all([
      prisma.payment.groupBy({ by: ['gateway', 'status'], where: { createdAt: { gte: from, lte: to } }, _count: true, _sum: { amount: true, fee: true } }),
      prisma.payment.groupBy({ by: ['method'], where: { createdAt: { gte: from, lte: to }, status: 'PAID' }, _count: true, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ['status'], where: { createdAt: { gte: from, lte: to } }, _count: true, _sum: { amount: true } }),
    ]);
    return { from, to, byGateway, byMethod, byStatus };
  },

  async couriers(q: RangeQuery) {
    const { from, to } = range(q);
    return prisma.$queryRaw<{ courierId: string; name: string; delivered: number; failed: number; avgMinutes: number | null; totalFee: number }[]>`
      SELECT cp.id AS "courierId", u.name,
             COUNT(*) FILTER (WHERE d.status = 'DELIVERED')::int AS delivered,
             COUNT(*) FILTER (WHERE d.status = 'FAILED')::int AS failed,
             AVG(EXTRACT(EPOCH FROM (d."deliveredAt" - d."pickedUpAt")) / 60) FILTER (WHERE d.status = 'DELIVERED' AND d."pickedUpAt" IS NOT NULL)::float8 AS "avgMinutes",
             COALESCE(SUM(d."courierFee") FILTER (WHERE d.status = 'DELIVERED'), 0)::float8 AS "totalFee"
      FROM courier_profiles cp JOIN users u ON u.id = cp."userId"
      LEFT JOIN deliveries d ON d."courierId" = cp.id AND d."createdAt" BETWEEN ${from} AND ${to}
      GROUP BY cp.id, u.name ORDER BY delivered DESC`;
  },

  async stock() {
    return prisma.$queryRaw<{ productId: string; name: string; sku: string; quantity: number; reserved: number; available: number; minStock: number; isLow: boolean }[]>`
      SELECT p.id AS "productId", p.name, p.sku, s.quantity, s.reserved, (s.quantity - s.reserved) AS available,
             s."minStock", (s.quantity - s.reserved) <= s."minStock" AS "isLow"
      FROM stocks s JOIN products p ON p.id = s."productId"
      WHERE p."deletedAt" IS NULL ORDER BY available ASC`;
  },

  async gallons() {
    const agg = await prisma.customerProfile.aggregate({ _sum: { gallonsHeld: true, depositHeld: true }, _count: { _all: true } });
    const top = await prisma.customerProfile.findMany({
      where: { gallonsHeld: { gt: 0 } }, orderBy: { gallonsHeld: 'desc' }, take: 10,
      select: { gallonsHeld: true, depositHeld: true, user: { select: { id: true, name: true, phone: true } } },
    });
    return { totalGallonsOutstanding: agg._sum.gallonsHeld ?? 0, totalDepositHeld: agg._sum.depositHeld ?? 0, customers: agg._count._all, topHolders: top };
  },
};
