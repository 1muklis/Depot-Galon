import { createHash } from 'node:crypto';
import { PaymentGateway, PaymentMethod, PaymentStatus } from '@prisma/client';
import { env } from '../../../config/env.js';
import { postJson, requireConfig } from '../http.js';
import { safeEqual } from '../../../core/utils/security.js';
import type { ChargeInput, ChargeResult, PaymentProvider, WebhookInput, WebhookResult } from '../types.js';

const md5 = (s: string) => createHash('md5').update(s).digest('hex');

/** Kode metode default Duitku; bankCode dari request akan dipakai langsung bila ada */
const DEFAULT_CODE: Partial<Record<PaymentMethod, string>> = {
  VIRTUAL_ACCOUNT: 'BC',
  QRIS: 'NQ',
  EWALLET: 'DA',
  CREDIT_CARD: 'VC',
  RETAIL_OUTLET: 'FT',
};

export class DuitkuProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.DUITKU;

  private get baseUrl() {
    return env.DUITKU_IS_PRODUCTION ? 'https://passport.duitku.com' : 'https://sandbox.duitku.com';
  }

  async createCharge(i: ChargeInput): Promise<ChargeResult> {
    const merchantCode = requireConfig(env.DUITKU_MERCHANT_CODE, 'DUITKU_MERCHANT_CODE');
    const apiKey = requireConfig(env.DUITKU_API_KEY, 'DUITKU_API_KEY');
    const paymentMethod = i.bankCode ?? DEFAULT_CODE[i.method] ?? 'VC';
    const res = await postJson(`${this.baseUrl}/webapi/api/merchant/v2/inquiry`, {
      merchantCode,
      paymentAmount: i.amount,
      paymentMethod,
      merchantOrderId: i.externalId,
      productDetails: `Pembayaran ${i.externalId}`,
      email: i.customer.email,
      customerVaName: i.customer.name.slice(0, 20),
      phoneNumber: i.customer.phone ?? undefined,
      itemDetails: i.items.map((it) => ({ name: it.name.slice(0, 50), price: it.price, quantity: it.quantity })),
      callbackUrl: `${env.APP_URL}${env.API_PREFIX}/payment-webhooks/duitku`,
      returnUrl: i.returnUrl,
      signature: md5(`${merchantCode}${i.externalId}${i.amount}${apiKey}`),
      expiryPeriod: i.expiresInMinutes,
    }, {});
    return {
      transactionId: res.reference,
      paymentUrl: res.paymentUrl,
      paymentCode: res.vaNumber,
      qrString: res.qrString,
      bankCode: paymentMethod,
      expiresAt: new Date(Date.now() + i.expiresInMinutes * 60_000),
      raw: res,
    };
  }

  /** Callback Duitku berupa form-urlencoded */
  parseWebhook({ body }: WebhookInput): WebhookResult {
    const apiKey = env.DUITKU_API_KEY ?? '';
    const { merchantCode, amount, merchantOrderId, resultCode, reference, signature } = body ?? {};
    if (!merchantOrderId || !signature) return { valid: false, error: 'payload tidak lengkap' };
    const expected = md5(`${merchantCode}${amount}${merchantOrderId}${apiKey}`);
    const valid = !!apiKey && merchantCode === env.DUITKU_MERCHANT_CODE && safeEqual(expected, String(signature));
    return {
      valid,
      externalId: merchantOrderId,
      transactionId: reference,
      status: resultCode === '00' ? PaymentStatus.PAID : PaymentStatus.FAILED,
      eventType: `resultCode:${resultCode}`,
      amount: Math.round(Number(amount)),
      signature,
    };
  }
}
