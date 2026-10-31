import { z } from 'zod';

export const createIncomeSourceSchema = z.object({
  name: z.string().min(2, 'Nama sumber pendapatan minimal 2 karakter').max(100),
  description: z.string().max(500).optional(),
});

export type CreateIncomeSourceInput = z.infer<typeof createIncomeSourceSchema>;

export const updateIncomeSourceSchema = z.object({
  name: z.string().min(2, 'Nama sumber pendapatan minimal 2 karakter').max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateIncomeSourceInput = z.infer<typeof updateIncomeSourceSchema>;

export const incomeSourceQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type IncomeSourceQuery = z.infer<typeof incomeSourceQuerySchema>;

export const incomeSourceResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IncomeSourceResponse = z.infer<typeof incomeSourceResponseSchema>;
