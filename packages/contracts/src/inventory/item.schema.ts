import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination.js';

export const stockStatusEnum = z.enum(['SAFE', 'LOW', 'OUT']);
export type StockStatus = z.infer<typeof stockStatusEnum>;

export const stockStatusLabels: Record<StockStatus, string> = {
  SAFE: 'Aman ✓',
  LOW: 'Menipis ⚠',
  OUT: 'Habis ✕',
};

export function calculateStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return 'OUT';
  if (quantity <= threshold) return 'LOW';
  return 'SAFE';
}

export const createItemSchema = z.object({
  name: z.string().min(2, 'Nama barang minimal 2 karakter').max(150),
  category: z.string().max(100).optional(),
  unit: z.string().min(1, 'Satuan barang wajib diisi').max(30),
  quantityOnHand: z.coerce.number().int('Jumlah stok harus bilangan bulat').min(0, 'Stok awal tidak boleh negatif').default(0),
  lowStockThreshold: z.coerce.number().int('Ambang batas harus bilangan bulat').min(0, 'Ambang batas tidak boleh negatif').default(0),
  location: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
  name: z.string().min(2, 'Nama barang minimal 2 karakter').max(150).optional(),
  category: z.string().max(100).optional(),
  unit: z.string().min(1, 'Satuan barang wajib diisi').max(30).optional(),
  quantityOnHand: z.coerce.number().int('Jumlah stok harus bilangan bulat').min(0, 'Stok tidak boleh negatif').optional(),
  lowStockThreshold: z.coerce.number().int('Ambang batas harus bilangan bulat').min(0, 'Ambang batas tidak boleh negatif').optional(),
  location: z.string().max(100).optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const itemQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['SAFE', 'LOW', 'OUT', 'all']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type ItemQuery = z.infer<typeof itemQuerySchema>;

export const itemResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable().optional(),
  unit: z.string(),
  quantityOnHand: z.number().int(),
  lowStockThreshold: z.number().int(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean(),
  status: stockStatusEnum,
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ItemResponse = z.infer<typeof itemResponseSchema>;
