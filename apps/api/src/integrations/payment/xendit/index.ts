import { PaymentGateway, PaymentStatus } from '@prisma/client';
import { env } from '../../../config/env.js';
import { header, postJson, requireConfig } from '../http.js';
import { safeEqual } from '../../../core/utils/security.js';
import type { ChargeInput, ChargeResult, PaymentProvider, WebhookInput, WebhookResult } from '../types.js';

/** Memakai Xendit Invoice API (halaman pembayaran hosted, mendukung VA/e-wallet/QRIS/kartu/retail) */
export class XenditProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.XENDIT;

  async createCharge(i: ChargeInput): Promise<ChargeResult> {
    const key = requireConfig(env.XENDIT_SECRET_KEY, 'XENDIT_SECRET_KEY');
    const res = await postJson(
      'https://api.xendit.co/v2/invoices',
      {
        external_id: i.externalId,
        amount: i.amount,
        payer_email: i.customer.email,
        description: `Pembayaran ${i.externalId}`,
        invoice_duration: i.expiresInMinutes * 60,
        currency: 'IDR',
        success_redirect_url: i.returnUrl,
        customer: { given_names: i.customer.name, email: i.customer.email, mobile_number: i.customer.phone ?? undefined },
        items: i.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
      },
      { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` },
    );
    return {
      transactionId: res.id,
      paymentUrl: res.invoice_url,
      expiresAt: res.expiry_date ? new Date(res.expiry_date) : undefined,
      raw: res,
    };
  }

  parseWebhook({ headers, body }: WebhookInput): WebhookResult {
    const token = header(headers, 'x-callback-token');
    const expected = env.XENDIT_CALLBACK_TOKEN;
    const valid = !!expected && !!token && safeEqual(expected, token);
    const s = String(body?.status ?? '').toUpperCase();
    const map: Record<string, PaymentStatus> = {
      PAID: PaymentStatus.PAID,
      SETTLED: PaymentStatus.PAID,
      EXPIRED: PaymentStatus.EXPIRED,
      PENDING: PaymentStatus.PENDING,
      FAILED: PaymentStatus.FAILED,
    };
    return {
      valid,
      externalId: body?.external_id,
      transactionId: body?.id,
      status: map[s] ?? PaymentStatus.PENDING,
      eventType: s,
      amount: body?.paid_amount != null ? Math.round(Number(body.paid_amount)) : body?.amount != null ? Math.round(Number(body.amount)) : undefined,
      signature: token,
    };
  }
}
