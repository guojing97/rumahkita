import { z } from 'zod';
import { idrAmountSchema } from '../common/idr.js';
import { paymentMethodEnum } from '../common/enums.js';
import { paginationQuerySchema } from '../common/pagination.js';

export const purchaseStatusEnum = z.enum(['draft', 'completed', 'cancelled']);
export type PurchaseStatus = z.infer<typeof purchaseStatusEnum>;

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: 'Draf',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const purchaseItemInputSchema = z.object({
  itemId: z.string().uuid().nullable().optional(),
  itemName: z.string().min(1, 'Nama item wajib diisi').max(150),
  quantity: z.coerce.number().int('Kuantitas harus bilangan bulat').positive('Kuantitas minimal 1'),
  unitPrice: idrAmountSchema,
});

export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

export const purchaseItemResponseSchema = z.object({
  id: z.string().uuid(),
  purchaseId: z.string().uuid(),
  itemId: z.string().uuid().nullable().optional(),
  itemName: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number(),
  subtotal: z.number(),
  createdAt: z.string(),
});

export type PurchaseItemResponse = z.infer<typeof purchaseItemResponseSchema>;

export const createPurchaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  expenseCategoryId: z.string().uuid('Kategori pengeluaran wajib dipilih'),
  vendor: z.string().max(150).optional(),
  paymentMethod: paymentMethodEnum.default('cash'),
  notes: z.string().max(500).optional(),
  items: z.array(purchaseItemInputSchema).min(1, 'Minimal satu baris barang pembelian'),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const updatePurchaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
  expenseCategoryId: z.string().uuid('Kategori pengeluaran wajib dipilih').optional(),
  vendor: z.string().max(150).optional(),
  paymentMethod: paymentMethodEnum.optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(purchaseItemInputSchema).min(1, 'Minimal satu baris barang pembelian').optional(),
});

export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

export const completePurchaseSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
});

export type CompletePurchaseInput = z.infer<typeof completePurchaseSchema>;

export const cancelPurchaseSchema = z.object({
  reason: z.string().min(3, 'Alasan pembatalan wajib diisi minimal 3 karakter').max(500),
});

export type CancelPurchaseInput = z.infer<typeof cancelPurchaseSchema>;

export const purchaseQuerySchema = paginationQuerySchema.extend({
  status: purchaseStatusEnum.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  vendor: z.string().optional(),
  createdBy: z.string().uuid().optional(),
});

export type PurchaseQuery = z.infer<typeof purchaseQuerySchema>;

export const purchaseResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  expenseCategoryId: z.string().uuid(),
  date: z.string(),
  totalAmount: z.number(),
  vendor: z.string().nullable().optional(),
  paymentMethod: paymentMethodEnum,
  status: purchaseStatusEnum,
  idempotencyKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(purchaseItemResponseSchema).optional(),
});

export type PurchaseResponse = z.infer<typeof purchaseResponseSchema>;
