import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error('Set SEED_ADMIN_PASSWORD (min. 8 karakter) di .env');

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Administrator', email, password: await bcrypt.hash(password, 12), role: 'ADMIN', emailVerifiedAt: new Date(), adminProfile: { create: { position: 'Super Admin' } } },
  });

  const zone = await prisma.deliveryZone.upsert({
    where: { name: 'Zona Pusat' }, update: {},
    create: { name: 'Zona Pusat', shippingFee: 5000, minOrder: 0, freeShippingMin: 100000, estimatedMinutes: 60 },
  });
  void zone;

  for (const s of [
    { label: 'Pagi', startTime: '08:00', endTime: '11:00' },
    { label: 'Siang', startTime: '11:00', endTime: '15:00' },
    { label: 'Sore', startTime: '15:00', endTime: '18:00' },
  ]) {
    if (!(await prisma.deliverySlot.findFirst({ where: { label: s.label } }))) await prisma.deliverySlot.create({ data: s });
  }

  const cat = await prisma.category.upsert({ where: { slug: 'air-galon' }, update: {}, create: { name: 'Air Galon', slug: 'air-galon' } });
  const products = [
    { sku: 'GLN-ISI-19', slug: 'galon-isi-ulang-19l', name: 'Galon Isi Ulang 19L', type: 'GALON_ISI_ULANG' as const, price: 18000, requiresEmptyReturn: true, depositAmount: 50000, volumeLiter: 19 },
    { sku: 'GLN-NEW-19', slug: 'galon-baru-19l', name: 'Galon Baru 19L (beserta isi)', type: 'GALON_BARU' as const, price: 25000, requiresEmptyReturn: false, depositAmount: 50000, volumeLiter: 19 },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku }, update: {},
      create: { ...p, categoryId: cat.id, stock: { create: { quantity: 200, minStock: 20 } } },
    });
  }

  const defaults: [string, string, string][] = [
    ['order.service_fee', '0', 'order'],
    ['order.unpaid_expire_minutes', '1440', 'order'],
    ['order.auto_complete_hours', '48', 'order'],
    ['delivery.courier_fee', '3000', 'delivery'],
    ['delivery.max_attempts', '3', 'delivery'],
    ['payment.manual_instructions', 'Transfer ke rekening resmi lalu unggah bukti pembayaran.', 'payment'],
  ];
  for (const [key, value, group] of defaults) await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value, group } });

  console.log(`Seed selesai. Admin: ${email}`);
}

main().finally(() => prisma.$disconnect());
