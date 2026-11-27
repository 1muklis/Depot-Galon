import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}
