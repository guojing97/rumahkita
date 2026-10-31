import { z } from 'zod';
import { idrAmountSchema } from '../common/idr.js';
import { paymentMethodEnum } from '../common/enums.js';
import { paginationQuerySchema } from '../common/pagination.js';
import { expenseCategoryResponseSchema } from './category.schema.js';

export const createExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  nominal: idrAmountSchema,
  categoryId: z.string().uuid('Kategori pengeluaran wajib dipilih'),
  paymentMethod: paymentMethodEnum.default('cash'),
  notes: z.string().max(500).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  nominal: idrAmountSchema.optional(),
  categoryId: z.string().uuid('Kategori pengeluaran wajib dipilih').optional(),
  paymentMethod: paymentMethodEnum.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const expenseQuerySchema = paginationQuerySchema.extend({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: paymentMethodEnum.optional(),
  purchaseId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;

export const expenseResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  categoryId: z.string().uuid(),
  purchaseId: z.string().uuid().nullable().optional(),
  date: z.string(),
  nominal: z.number(),
  paymentMethod: paymentMethodEnum,
  notes: z.string().nullable().optional(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  category: expenseCategoryResponseSchema.optional(),
});

export type ExpenseResponse = z.infer<typeof expenseResponseSchema>;
