import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination.js';

export const stockMovementReasonEnum = z.enum([
  'purchase',
  'manual_correction',
  'waste',
  'initial',
  'reversal',
]);

export type StockMovementReason = z.infer<typeof stockMovementReasonEnum>;

export const stockMovementReasonLabels: Record<StockMovementReason, string> = {
  purchase: 'Pembelian',
  manual_correction: 'Koreksi Manual',
  waste: 'Rusak / Basi / Hilang',
  initial: 'Stok Awal',
  reversal: 'Pembatalan Pembelian',
};

export const stockAdjustmentSchema = z.object({
  delta: z.coerce.number().int('Perubahan kuantitas harus berupa bilangan bulat').refine((val) => val !== 0, 'Delta perubahan stok tidak boleh 0'),
  reason: z.string().trim().min(3, 'Alasan penyesuaian stok wajib diisi minimal 3 karakter').max(500),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const stockMovementQuerySchema = paginationQuerySchema.extend({
  itemId: z.string().uuid().optional(),
  reason: stockMovementReasonEnum.optional(),
});

export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>;

export const stockMovementResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantityDelta: z.number().int(),
  resultingQuantity: z.number().int(),
  reason: stockMovementReasonEnum,
  notes: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
});

export type StockMovementResponse = z.infer<typeof stockMovementResponseSchema>;
