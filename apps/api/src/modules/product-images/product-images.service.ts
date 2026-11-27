import { prisma } from '../../database/prisma.js';
import { AppError } from '../../core/errors/app-error.js';
import { storage } from '../../integrations/storage/index.js';

async function assertProduct(productId: string) {
  const p = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!p) throw AppError.notFound('Produk tidak ditemukan');
}

export const productImagesService = {
  async list(productId: string) {
    await assertProduct(productId);
    return prisma.productImage.findMany({ where: { productId }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] });
  },

  async add(productId: string, input: { url?: string; file?: Express.Multer.File; isPrimary?: boolean; sortOrder?: number }) {
    await assertProduct(productId);
    const count = await prisma.productImage.count({ where: { productId } });
    if (count >= 10) throw AppError.unprocessable('Maksimal 10 gambar per produk');
    const url = input.file ? await storage.save(input.file, 'products') : input.url;
    if (!url) throw AppError.badRequest('Kirim file "image" atau field "url"');
    const isPrimary = input.isPrimary || count === 0;
    return prisma.$transaction(async (tx) => {
      if (isPrimary) await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
      return tx.productImage.create({ data: { productId, url, isPrimary, sortOrder: input.sortOrder ?? count } });
    });
  },

  async update(productId: string, imageId: string, data: { isPrimary?: boolean; sortOrder?: number }) {
    const img = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!img) throw AppError.notFound('Gambar tidak ditemukan');
    return prisma.$transaction(async (tx) => {
      if (data.isPrimary) await tx.productImage.updateMany({ where: { productId, isPrimary: true }, data: { isPrimary: false } });
      return tx.productImage.update({ where: { id: imageId }, data });
    });
  },

  async remove(productId: string, imageId: string) {
    const img = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!img) throw AppError.notFound('Gambar tidak ditemukan');
    await prisma.productImage.delete({ where: { id: imageId } });
    await storage.remove(img.url);
    if (img.isPrimary) {
      const next = await prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' } });
      if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  },
};
