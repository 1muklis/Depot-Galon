import { createHash } from 'node:crypto';
import { PaymentGateway, PaymentMethod, PaymentStatus } from '@prisma/client';
import { env } from '../../../config/env.js';
import { header, postJson, requireConfig } from '../http.js';
import { safeEqual } from '../../../core/utils/security.js';
import type { ChargeInput, ChargeResult, PaymentProvider, WebhookInput, WebhookResult } from '../types.js';

const ENABLED: Partial<Record<PaymentMethod, string[]>> = {
  BANK_TRANSFER: ['bank_transfer'],
  VIRTUAL_ACCOUNT: ['bca_va', 'bni_va', 'bri_va', 'permata_va', 'echannel', 'other_va'],
  EWALLET: ['gopay', 'shopeepay'],
  QRIS: ['qris', 'gopay'],
  CREDIT_CARD: ['credit_card'],
  RETAIL_OUTLET: ['indomaret', 'alfamart'],
};

export class MidtransProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.MIDTRANS;

  private get baseUrl() {
    return env.MIDTRANS_IS_PRODUCTION ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  }

  async createCharge(i: ChargeInput): Promise<ChargeResult> {
    const key = requireConfig(env.MIDTRANS_SERVER_KEY, 'MIDTRANS_SERVER_KEY');
    const auth = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
    const res = await postJson(
      `${this.baseUrl}/snap/v1/transactions`,
      {
        transaction_details: { order_id: i.externalId, gross_amount: i.amount },
        customer_details: { first_name: i.customer.name, email: i.customer.email, phone: i.customer.phone ?? undefined },
        item_details: i.items.map((it, idx) => ({ id: String(idx + 1), name: it.name.slice(0, 50), price: it.price, quantity: it.quantity })),
        enabled_payments: ENABLED[i.method],
        expiry: { unit: 'minute', duration: i.expiresInMinutes },
        callbacks: { finish: i.returnUrl },
      },
      { Authorization: auth },
    );
    return {
      snapToken: res.token,
      paymentUrl: res.redirect_url,
      expiresAt: new Date(Date.now() + i.expiresInMinutes * 60_000),
      raw: res,
    };
  }

  parseWebhook({ body }: WebhookInput): WebhookResult {
    const key = env.MIDTRANS_SERVER_KEY ?? '';
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, transaction_id } = body ?? {};
    if (!order_id || !signature_key) return { valid: false, error: 'payload tidak lengkap' };
    const expected = createHash('sha512').update(`${order_id}${status_code}${gross_amount}${key}`).digest('hex');
    const valid = !!key && safeEqual(expected, String(signature_key));

    let status: PaymentStatus = PaymentStatus.PENDING;
    switch (transaction_status) {
      case 'capture':
        status = fraud_status === 'challenge' ? PaymentStatus.PENDING : PaymentStatus.PAID;
        break;
      case 'settlement': status = PaymentStatus.PAID; break;
      case 'deny': status = PaymentStatus.FAILED; break;
      case 'cancel': status = PaymentStatus.CANCELLED; break;
      case 'expire': status = PaymentStatus.EXPIRED; break;
      case 'failure': status = PaymentStatus.FAILED; break;
      case 'refund': status = PaymentStatus.REFUNDED; break;
      case 'partial_refund': status = PaymentStatus.PARTIAL_REFUND; break;
    }
    return {
      valid,
      externalId: order_id,
      transactionId: transaction_id,
      status,
      eventType: transaction_status,
      amount: Math.round(Number(gross_amount)),
      signature: signature_key,
    };
  }
}
