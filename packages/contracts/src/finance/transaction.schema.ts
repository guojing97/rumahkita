import { z } from 'zod';
import { paginationQuerySchema, paginatedResponseSchema } from '../common/pagination.js';

export const transactionTypeEnum = z.enum(['all', 'income', 'expense']);
export type TransactionType = z.infer<typeof transactionTypeEnum>;

export const transactionQuerySchema = paginationQuerySchema.extend({
  type: transactionTypeEnum.optional().default('all'),
  search: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  categoryId: z.string().uuid().optional(),
});

export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const transactionItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['income', 'expense']),
  date: z.string(),
  nominal: z.number(),
  categoryName: z.string().nullable().optional(),
  sourceName: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

export const paginatedTransactionsResponseSchema = paginatedResponseSchema(transactionItemSchema);
export type PaginatedTransactionsResponse = z.infer<typeof paginatedTransactionsResponseSchema>;
