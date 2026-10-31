import { z } from 'zod';

export const householdRoleEnum = z.enum(['owner', 'member']);
export type HouseholdRole = z.infer<typeof householdRoleEnum>;

export const paymentMethodEnum = z.enum(['cash', 'transfer', 'ewallet', 'other']);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
  ewallet: 'E-Wallet',
  other: 'Lainnya',
};
