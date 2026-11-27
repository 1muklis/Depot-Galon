import { z } from 'zod';
import { NotificationType, Role } from '@prisma/client';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';

export const notificationQuery = paginationQuery.extend({
  isRead: boolQuery,
  type: z.nativeEnum(NotificationType).optional(),
});
export type NotificationQuery = z.infer<typeof notificationQuery>;

export const broadcastBody = z.object({
  type: z.nativeEnum(NotificationType).default(NotificationType.PROMO),
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(1000),
  role: z.nativeEnum(Role).optional(),
  userIds: z.array(z.string()).max(5000).optional(),
  data: z.record(z.unknown()).optional(),
});
export type BroadcastBody = z.infer<typeof broadcastBody>;
export const idParam = z.object({ id: z.string().min(1) });
