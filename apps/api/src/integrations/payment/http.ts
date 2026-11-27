import { AppError } from '../../core/errors/app-error.js';
import { ErrorCodes } from '../../core/errors/error-codes.js';

export async function postJson<T = any>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new AppError(502, 'Tidak dapat terhubung ke payment gateway', ErrorCodes.PAYMENT_GATEWAY_ERROR, String(e));
  }
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new AppError(502, 'Payment gateway menolak permintaan', ErrorCodes.PAYMENT_GATEWAY_ERROR, json);
  }
  return json as T;
}

export const requireConfig = (value: string | undefined, name: string) => {
  if (!value) throw new AppError(500, `${name} belum dikonfigurasi`, ErrorCodes.PAYMENT_GATEWAY_ERROR);
  return value;
};

export const header = (h: Record<string, string | string[] | undefined>, name: string) => {
  const v = h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};
