import { z } from 'zod';
import { idrAmountSchema } from '../common/idr.js';
import { paymentMethodEnum } from '../common/enums.js';
import { paginationQuerySchema } from '../common/pagination.js';

export const debtTypeEnum = z.enum(['payable', 'receivable']);
export type DebtType = z.infer<typeof debtTypeEnum>;

export const debtTypeLabels: Record<DebtType, string> = {
  payable: 'Hutang (Kewajiban Bayar)',
  receivable: 'Piutang (Hak Tagih)',
};

export const debtStatusEnum = z.enum(['open', 'partially_paid', 'settled', 'overdue', 'cancelled']);
export type DebtStatus = z.infer<typeof debtStatusEnum>;

export const debtStatusLabels: Record<DebtStatus, string> = {
  open: 'Belum Dibayar',
  partially_paid: 'Sebagian',
  settled: 'Lunas',
  overdue: 'Terlambat',
  cancelled: 'Dibatalkan',
};

export const createDebtReceivableSchema = z.object({
  type: debtTypeEnum,
  partyName: z.string().min(2, 'Nama pihak terkait minimal 2 karakter').max(150),
  description: z.string().max(255).optional(),
  principalAmount: idrAmountSchema,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal jatuh tempo harus YYYY-MM-DD').optional(),
  notes: z.string().max(500).optional(),
});

export type CreateDebtReceivableInput = z.infer<typeof createDebtReceivableSchema>;

export const updateDebtReceivableSchema = z.object({
  partyName: z.string().min(2, 'Nama pihak terkait minimal 2 karakter').max(150).optional(),
  description: z.string().max(255).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal jatuh tempo harus YYYY-MM-DD').nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type UpdateDebtReceivableInput = z.infer<typeof updateDebtReceivableSchema>;

export const recordPaymentSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal pembayaran harus YYYY-MM-DD'),
  amount: idrAmountSchema,
  paymentMethod: paymentMethodEnum.default('transfer'),
  notes: z.string().max(500).optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const debtReceivableQuerySchema = paginationQuerySchema.extend({
  type: debtTypeEnum.optional(),
  status: debtStatusEnum.optional(),
  search: z.string().optional(),
});

export type DebtReceivableQuery = z.infer<typeof debtReceivableQuerySchema>;

export const debtPaymentResponseSchema = z.object({
  id: z.string().uuid(),
  debtReceivableId: z.string().uuid(),
  amount: z.number(),
  paymentDate: z.string(),
  paymentMethod: paymentMethodEnum,
  notes: z.string().nullable().optional(),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
});

export type DebtPaymentResponse = z.infer<typeof debtPaymentResponseSchema>;

export const debtReceivableResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  type: debtTypeEnum,
  partyName: z.string(),
  description: z.string().nullable().optional(),
  principalAmount: z.number(),
  remainingBalance: z.number(),
  dueDate: z.string().nullable().optional(),
  status: debtStatusEnum,
  notes: z.string().nullable().optional(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  payments: z.array(debtPaymentResponseSchema).optional(),
});

export type DebtReceivableResponse = z.infer<typeof debtReceivableResponseSchema>;
