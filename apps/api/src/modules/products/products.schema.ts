import { z } from 'zod';
import { ProductType } from '@prisma/client';
import { boolQuery, paginationQuery } from '../../core/utils/pagination.js';

const money = z.coerce.number().min(0).max(999_999_999);

export const productQuery = paginationQuery.extend({
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  type: z.nativeEnum(ProductType).optional(),
  isFeatured: boolQuery,
  isActive: boolQuery, // hanya berlaku untuk admin
  inStock: boolQuery,
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['createdAt', 'price', 'name', 'soldCount', 'ratingAvg']).optional(),
});
export type ProductQuery = z.infer<typeof productQuery>;

export const createProductBody = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().nullable().optional(),
  name: z.string().trim().min(2).max(150),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(180).optional(),
  sku: z.string().trim().min(2).max(50),
  description: z.string().max(5000).optional(),
  type: z.nativeEnum(ProductType),
  volumeLiter: z.coerce.number().positive().max(1000).optional(),
  price: money,
  costPrice: money.optional(),
  requiresEmptyReturn: z.boolean().default(false),
  depositAmount: money.default(0),
  weightKg: z.coerce.number().positive().max(1000).optional(),
  minOrderQty: z.coerce.number().int().min(1).default(1),
  maxOrderQty: z.coerce.number().int().min(1).nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  initialStock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(10),
  images: z.array(z.object({ url: z.string().url(), isPrimary: z.boolean().optional() })).max(10).optional(),
  priceTiers: z.array(z.object({ minQty: z.coerce.number().int().min(2), price: money })).max(10).optional(),
}).refine((v) => !v.maxOrderQty || v.maxOrderQty >= v.minOrderQty, { message: 'maxOrderQty harus >= minOrderQty', path: ['maxOrderQty'] });
export type CreateProductBody = z.infer<typeof createProductBody>;

export const updateProductBody = z.object({
  categoryId: z.string().min(1),
  brandId: z.string().nullable(),
  name: z.string().trim().min(2).max(150),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(180),
  sku: z.string().trim().min(2).max(50),
  description: z.string().max(5000).nullable(),
  type: z.nativeEnum(ProductType),
  volumeLiter: z.coerce.number().positive().max(1000).nullable(),
  price: money,
  costPrice: money.nullable(),
  requiresEmptyReturn: z.boolean(),
  depositAmount: money,
  weightKg: z.coerce.number().positive().max(1000).nullable(),
  minOrderQty: z.coerce.number().int().min(1),
  maxOrderQty: z.coerce.number().int().min(1).nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
}).partial();
export type UpdateProductBody = z.infer<typeof updateProductBody>;

export const idOrSlugParam = z.object({ idOrSlug: z.string().min(1) });
export const idParam = z.object({ id: z.string().min(1) });
