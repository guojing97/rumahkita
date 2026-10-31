import { z } from 'zod';

export const idrAmountSchema = z.preprocess(
  (val) => (typeof val === 'boolean' ? NaN : val),
  z.coerce
    .number()
    .int('Nominal harus berupa bilangan bulat')
    .positive('Nominal harus lebih dari 0')
    .max(999_999_999_999, 'Nominal melebihi batas wajar')
);

export const optionalIdrAmountSchema = z.preprocess(
  (val) => (val === null || val === '' || val === undefined ? undefined : typeof val === 'boolean' ? NaN : val),
  z.coerce
    .number()
    .int('Nominal harus berupa bilangan bulat')
    .min(0, 'Nominal tidak boleh negatif')
    .max(999_999_999_999, 'Nominal melebihi batas wajar')
    .optional()
);

export function formatIDR(amount: number | bigint): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function parseIDR(formatted: string): number {
  const cleaned = formatted.trim().replace(/,\d{2}$/, '').replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}
