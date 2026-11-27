import { z } from 'zod';

export const keyParam = z.object({ key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/) });
export const upsertSettingBody = z.object({
  value: z.string(),
  group: z.string().min(1).max(50).optional(),
  isSecret: z.boolean().optional(),
});
