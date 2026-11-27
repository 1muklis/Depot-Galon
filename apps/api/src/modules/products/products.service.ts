import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { Db } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { buildMeta, getPagination } from '../../core/utils/pagination.js';
import { D, slugify } from '../../core/utils/helpers.js';
import type { CreateProductBody, ProductQuery, UpdateProductBody } from './products.schema.js';

const include = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: { orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }] },
  priceTiers: { orderBy: { minQty: 'asc' as const } },
  stock: { select: { quantity: true, reserved: true, minStock: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRels = Prisma.ProductGetPayload<{ include: typeof include }>;

/** Tambahkan field turunan `available` (stok yang bisa dipesan) */
const decorate = (p: ProductWithRels, isAdmin: boolean) => {
  const available = p.stock ? Math.max(0, p.stock.quantity - p.stock.reserved) : 0;
  const { stock, costPrice, ...rest } = p;
  return { ...rest, ...(isAdmin && { costPrice, stock }), available, inStock: available > 0 };
};

/** Harga satuan berdasarkan tier grosir: tier dengan minQty terbesar yang <= qty */
export function resolveUnitPrice(product: { price: Prisma.Decimal }, tiers: { minQty: number; price: Prisma.Decimal }[], qty: number) {
  const tier = [...tiers].filter((t) => t.minQty <= qty).sort((a, b) => b.minQty - a.minQty)[0];
  return tier ? tier.price : product.price;
}

export const productsService = {
  async list(q: ProductQuery, role?: Role) {
    const isAdmin = role === Role.ADMIN;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(isAdmin ? (q.isActive !== undefined && { isActive: q.isActive }) : { isActive: true }),
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.brandId && { brandId: q.brandId }),
      ...(q.type && { type: q.type }),
      ...(q.isFeatured !== undefined && { isFeatured: q.isFeatured }),
      ...((q.minPrice !== undefined || q.maxPrice !== undefined) && { price: { ...(q.minPrice !== undefined && { gte: q.minPrice }), ...(q.maxPrice !== undefined && { lte: q.maxPrice }) } }),
      ...(q.search && { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }] }),
    };
    const { page, limit, skip, take } = getPagination(q);
    const orderBy = { [q.sortBy ?? 'createdAt']: q.sortOrder } as Prisma.ProductOrderByWithRelationInput;
    let [rows, total] = await Promise.all([
      prisma.product.findMany({ where, include, skip, take, orderBy }),
      prisma.product.count({ where }),
    ]);
    let items = rows.map((r) => decorate(r, isAdmin));
    // filter inStock dilakukan setelah query karena bergantung pada selisih dua kolom
    if (q.inStock !== undefined) items = items.filter((i) => i.inStock === q.inStock);
    return { items, meta: buildMeta(page, limit, total) };
  },

  async get(idOrSlug: string, role?: Role) {
    const isAdmin = role === Role.ADMIN;
    const p = await prisma.product.findFirst({
      where: { deletedAt: null, ...(!isAdmin && { isActive: true }), OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include,
    });
    if (!p) throw AppError.notFound('Produk tidak ditemukan');
    return decorate(p, isAdmin);
  },

  async create(b: CreateProductBody) {
    const { initialStock, minStock, images, priceTiers, ...data } = b;
    const slug = data.slug ?? slugify(data.name);
    const [skuDup, slugDup] = await Promise.all([
      prisma.product.findUnique({ where: { sku: data.sku } }),
      prisma.product.findUnique({ where: { slug } }),
    ]);
    if (skuDup) throw AppError.conflict('SKU sudah dipakai');
    if (slugDup) throw AppError.conflict('Slug sudah dipakai, ubah nama atau isi slug manual');
    if (!(await prisma.category.findUnique({ where: { id: data.categoryId } }))) throw AppError.unprocessable('Kategori tidak ditemukan');
    if (data.brandId && !(await prisma.brand.findUnique({ where: { id: data.brandId } }))) throw AppError.unprocessable('Brand tidak ditemukan');

    return prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          ...data, slug,
          stock: { create: { quantity: initialStock, minStock } },
          ...(images?.length && { images: { create: images.map((im, i) => ({ url: im.url, isPrimary: im.isPrimary ?? i === 0, sortOrder: i })) } }),
          ...(priceTiers?.length && { priceTiers: { create: priceTiers } }),
        },
        include,
      });
      if (initialStock > 0) {
        await tx.stockMovement.create({ data: { productId: p.id, type: 'IN', quantity: initialStock, note: 'Stok awal' } });
      }
      return decorate(p, true);
    });
  },

  async update(id: string, b: UpdateProductBody) {
    const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Produk tidak ditemukan');
    if (b.sku && b.sku !== existing.sku && (await prisma.product.findUnique({ where: { sku: b.sku } }))) throw AppError.conflict('SKU sudah dipakai');
    if (b.slug && b.slug !== existing.slug && (await prisma.product.findUnique({ where: { slug: b.slug } }))) throw AppError.conflict('Slug sudah dipakai');
    const min = b.minOrderQty ?? existing.minOrderQty;
    const max = b.maxOrderQty === undefined ? existing.maxOrderQty : b.maxOrderQty;
    if (max && max < min) throw AppError.unprocessable('maxOrderQty harus >= minOrderQty');
    const p = await prisma.product.update({ where: { id }, data: b, include });
    return decorate(p, true);
  },

  async remove(id: string) {
    const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Produk tidak ditemukan');
    // soft delete: riwayat order tetap utuh; sku/slug diberi suffix agar bisa dipakai ulang
    const stamp = Date.now();
    await prisma.$transaction([
      prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, sku: `${existing.sku}__del${stamp}`, slug: `${existing.slug}__del${stamp}` } }),
      prisma.cartItem.deleteMany({ where: { productId: id } }),
    ]);
  },

  /** Hitung ulang rating dari review yang terlihat */
  async recalcRating(productId: string, db: Db = prisma) {
    const agg = await db.review.aggregate({ where: { productId, isVisible: true }, _avg: { rating: true }, _count: { rating: true } });
    await db.product.update({
      where: { id: productId },
      data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100, ratingCount: agg._count.rating },
    });
  },

  price: (v: Prisma.Decimal.Value) => D(v),
};
