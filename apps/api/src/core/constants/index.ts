import { OrderStatus } from '@prisma/client';

/** Status order yang dihitung sebagai pendapatan (sudah dibayar / COD diproses) */
export const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.ON_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

/** Status di mana stok masih dalam kondisi "reserved" */
export const STOCK_RESERVED_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.READY_FOR_DELIVERY,
  OrderStatus.ON_DELIVERY,
];

export const SETTING_KEYS = {
  SERVICE_FEE: 'order.service_fee',
  UNPAID_EXPIRE_MINUTES: 'order.unpaid_expire_minutes',
  AUTO_COMPLETE_HOURS: 'order.auto_complete_hours',
  COURIER_FEE: 'delivery.courier_fee',
  MAX_DELIVERY_ATTEMPTS: 'delivery.max_attempts',
  LOYALTY_RATE: 'loyalty.points_per_idr',
} as const;
