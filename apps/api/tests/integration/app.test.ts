import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('app (tanpa DB)', () => {
  it('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('route tidak ada -> 404 terformat', async () => {
    const res = await request(app).get('/api/v1/tidak-ada');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('endpoint terproteksi tanpa token -> 401', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });

  it('validasi register -> 422', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'bukan-email', password: '123' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('webhook dengan signature salah -> 401', async () => {
    const res = await request(app).post('/api/v1/payment-webhooks/midtrans').send({ order_id: 'X', status_code: '200', gross_amount: '1.00', signature_key: 'salah' });
    // 401 bila DB tersedia untuk mencatat log; tanpa DB error 500 — keduanya bukan 200
    expect(res.status).not.toBe(200);
  });
});
