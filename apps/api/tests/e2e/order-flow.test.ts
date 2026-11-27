import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

/**
 * E2E butuh database yang sudah di-migrate dan di-seed (npm run prisma:seed) serta
 * SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Dilewati bila DB tidak dikonfigurasi.
 */
const enabled = !!process.env.E2E_DB && !!process.env.SEED_ADMIN_PASSWORD;
const app = createApp();
const api = '/api/v1';

describe.skipIf(!enabled)('alur pesanan COD end-to-end', () => {
  const stamp = Date.now();
  let adminToken = '', custToken = '', zoneId = '', productId = '', addressId = '', orderId = '';

  beforeAll(async () => {
    const admin = await request(app).post(`${api}/auth/login`).send({ identifier: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com', password: process.env.SEED_ADMIN_PASSWORD });
    adminToken = admin.body.data.accessToken;
    const zones = await request(app).get(`${api}/delivery-zones`);
    zoneId = zones.body.data[0].id;
    const products = await request(app).get(`${api}/products?search=isi ulang`);
    productId = products.body.data[0].id;

    const reg = await request(app).post(`${api}/auth/register`).send({ name: 'Tester', email: `t${stamp}@example.com`, password: 'Password123' });
    custToken = reg.body.data.accessToken;
  });

  it('customer membuat alamat, checkout, dan memilih COD', async () => {
    const addr = await request(app).post(`${api}/addresses`).set('Authorization', `Bearer ${custToken}`).send({
      label: 'Rumah', recipientName: 'Tester', phone: '081234567890', street: 'Jl. Contoh 1', city: 'Bandung', province: 'Jawa Barat', zoneId,
    });
    expect(addr.status).toBe(201);
    addressId = addr.body.data.id;

    const order = await request(app).post(`${api}/orders`).set('Authorization', `Bearer ${custToken}`).send({ addressId, items: [{ productId, quantity: 2 }] });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe('PENDING_PAYMENT');
    orderId = order.body.data.id;

    const pay = await request(app).post(`${api}/payments`).set('Authorization', `Bearer ${custToken}`).send({ orderId, method: 'COD' });
    expect(pay.status).toBe(201);

    const after = await request(app).get(`${api}/orders/${orderId}`).set('Authorization', `Bearer ${custToken}`);
    expect(after.body.data.status).toBe('PROCESSING');
  });

  it('customer lain tidak bisa melihat pesanan', async () => {
    const other = await request(app).post(`${api}/auth/register`).send({ name: 'Lain', email: `o${stamp}@example.com`, password: 'Password123' });
    const res = await request(app).get(`${api}/orders/${orderId}`).set('Authorization', `Bearer ${other.body.data.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('admin melihat pesanan di dashboard laporan', async () => {
    const res = await request(app).get(`${api}/reports/dashboard`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ordersToday).toBeGreaterThan(0);
  });
});
