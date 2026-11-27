import { PaymentGateway } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';
import { DokuProvider } from './doku/index.js';
import { DuitkuProvider } from './duitku/index.js';
import { MidtransProvider } from './midtrans/index.js';
import { XenditProvider } from './xendit/index.js';
import type { PaymentProvider } from './types.js';

const providers: Partial<Record<PaymentGateway, PaymentProvider>> = {
  MIDTRANS: new MidtransProvider(),
  XENDIT: new XenditProvider(),
  DOKU: new DokuProvider(),
  DUITKU: new DuitkuProvider(),
};

export function getProvider(gateway: PaymentGateway): PaymentProvider {
  const p = providers[gateway];
  if (!p) throw AppError.badRequest(`Gateway ${gateway} tidak memiliki provider online`);
  return p;
}

export * from './types.js';
