import type { PaymentGateway, PaymentMethod, PaymentStatus } from '@prisma/client';

export interface ChargeInput {
  externalId: string;
  amount: number; // IDR, bilangan bulat
  method: PaymentMethod;
  bankCode?: string;
  customer: { name: string; email: string; phone?: string | null };
  items: { name: string; price: number; quantity: number }[];
  expiresInMinutes: number;
  returnUrl: string;
}

export interface ChargeResult {
  transactionId?: string;
  paymentUrl?: string;
  snapToken?: string;
  qrString?: string;
  paymentCode?: string;
  bankCode?: string;
  expiresAt?: Date;
  raw: unknown;
}

export interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  body: any;
  rawBody?: Buffer;
  path: string;
}

export interface WebhookResult {
  valid: boolean;
  externalId?: string;
  transactionId?: string;
  status?: PaymentStatus;
  eventType?: string;
  amount?: number;
  signature?: string;
  error?: string;
}

export interface PaymentProvider {
  readonly gateway: PaymentGateway;
  createCharge(input: ChargeInput): Promise<ChargeResult>;
  parseWebhook(input: WebhookInput): WebhookResult;
}
