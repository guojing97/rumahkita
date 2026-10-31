import { z } from 'zod';
import { idrAmountSchema } from '../common/idr.js';
import { paginationQuerySchema } from '../common/pagination.js';
import { incomeSourceResponseSchema } from './income-source.schema.js';
import { incomeCategoryResponseSchema } from './category.schema.js';

export const createIncomeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  nominal: idrAmountSchema,
  sourceId: z.string().uuid('Sumber pendapatan wajib dipilih'),
  categoryId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;

export const updateIncomeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  nominal: idrAmountSchema.optional(),
  sourceId: z.string().uuid('Sumber pendapatan wajib dipilih').optional(),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;

export const incomeQuerySchema = paginationQuerySchema.extend({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type IncomeQuery = z.infer<typeof incomeQuerySchema>;

export const incomeResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  sourceId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string(),
  nominal: z.number(),
  notes: z.string().nullable().optional(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  source: incomeSourceResponseSchema.optional(),
  category: incomeCategoryResponseSchema.nullable().optional(),
});

export type IncomeResponse = z.infer<typeof incomeResponseSchema>;
