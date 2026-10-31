import { z } from 'zod';
import { optionalIdrAmountSchema } from '../common/idr.js';

export const createIncomeCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter').max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
});

export type CreateIncomeCategoryInput = z.infer<typeof createIncomeCategorySchema>;

export const updateIncomeCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter').max(100).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
});

export type UpdateIncomeCategoryInput = z.infer<typeof updateIncomeCategorySchema>;

export const incomeCategoryResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IncomeCategoryResponse = z.infer<typeof incomeCategoryResponseSchema>;

export const createExpenseCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter').max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  budgetLimit: optionalIdrAmountSchema,
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;

export const updateExpenseCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter').max(100).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  budgetLimit: optionalIdrAmountSchema,
});

export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;

export const expenseCategoryResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  budgetLimit: z.number().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ExpenseCategoryResponse = z.infer<typeof expenseCategoryResponseSchema>;
