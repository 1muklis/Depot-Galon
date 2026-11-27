import { createHash, createHmac } from 'node:crypto';
import { PaymentGateway, PaymentStatus } from '@prisma/client';
import { env } from '../../../config/env.js';
import { header, postJson, requireConfig } from '../http.js';
import { safeEqual } from '../../../core/utils/security.js';
import type { ChargeInput, ChargeResult, PaymentProvider, WebhookInput, WebhookResult } from '../types.js';

const CHECKOUT_PATH = '/checkout/v1/payment';

function sign(clientId: string, secret: string, requestId: string, timestamp: string, target: string, rawBody: string) {
  const digest = createHash('sha256').update(rawBody).digest('base64');
  const component = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${target}\nDigest:${digest}`;
  return `HMACSHA256=${createHmac('sha256', secret).update(component).digest('base64')}`;
}

/** DOKU Checkout (hosted payment page) */
export class DokuProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.DOKU;

  private get baseUrl() {
    return env.DOKU_IS_PRODUCTION ? 'https://api.doku.com' : 'https://api-sandbox.doku.com';
  }

  async createCharge(i: ChargeInput): Promise<ChargeResult> {
    const clientId = requireConfig(env.DOKU_CLIENT_ID, 'DOKU_CLIENT_ID');
    const secret = requireConfig(env.DOKU_SECRET_KEY, 'DOKU_SECRET_KEY');
    const body = {
      order: { amount: i.amount, invoice_number: i.externalId, callback_url: i.returnUrl, line_items: i.items.map((it) => ({ name: it.name.slice(0, 40), price: it.price, quantity: it.quantity })) },
      payment: { payment_due_date: i.expiresInMinutes },
      customer: { name: i.customer.name, email: i.customer.email, phone: i.customer.phone ?? undefined },
    };
    const raw = JSON.stringify(body);
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const res = await postJson(`${this.baseUrl}${CHECKOUT_PATH}`, body, {
      'Client-Id': clientId,
      'Request-Id': requestId,
      'Request-Timestamp': timestamp,
      Signature: sign(clientId, secret, requestId, timestamp, CHECKOUT_PATH, raw),
    });
    const p = res?.response?.payment ?? {};
    return {
      paymentUrl: p.url,
      transactionId: p.token_id,
      expiresAt: new Date(Date.now() + i.expiresInMinutes * 60_000),
      raw: res,
    };
  }

  parseWebhook({ headers, body, rawBody, path }: WebhookInput): WebhookResult {
    const secret = env.DOKU_SECRET_KEY ?? '';
    const clientId = header(headers, 'client-id') ?? '';
    const requestId = header(headers, 'request-id') ?? '';
    const timestamp = header(headers, 'request-timestamp') ?? '';
    const received = header(headers, 'signature') ?? '';
    const raw = rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    const expected = secret ? sign(clientId, secret, requestId, timestamp, path, raw) : '';
    const valid = !!secret && clientId === env.DOKU_CLIENT_ID && !!received && safeEqual(expected, received);

    const s = String(body?.transaction?.status ?? '').toUpperCase();
    const status = s === 'SUCCESS' ? PaymentStatus.PAID : s === 'FAILED' ? PaymentStatus.FAILED : s === 'EXPIRED' ? PaymentStatus.EXPIRED : PaymentStatus.PENDING;
    return {
      valid,
      externalId: body?.order?.invoice_number,
      transactionId: body?.transaction?.original_request_id ?? body?.service?.id,
      status,
      eventType: s,
      amount: body?.order?.amount != null ? Math.round(Number(body.order.amount)) : undefined,
      signature: received,
    };
  }
}
