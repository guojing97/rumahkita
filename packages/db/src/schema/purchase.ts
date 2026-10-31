import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  date,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { households } from './household';
import { expenseCategories } from './finance';
import { paymentMethodEnum } from './common';
import { items } from './inventory';

export const purchaseStatusEnum = pgEnum('purchase_status', ['draft', 'completed', 'cancelled']);

// Table 12: purchases
export const purchases = pgTable(
  'purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    expenseCategoryId: uuid('expense_category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    date: date('date', { mode: 'string' }).notNull(),
    totalAmount: numeric('total_amount', { precision: 14, scale: 0 }).notNull().default('0'),
    vendor: varchar('vendor', { length: 150 }),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
    status: purchaseStatusEnum('status').notNull().default('draft'),
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
    notes: text('notes'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    totalNonNegativeChk: check('chk_purchases_total_non_negative', sql`${table.totalAmount} >= 0`),
    householdDateIdx: index('purchases_household_date_idx').on(table.householdId, table.date),
    statusIdx: index('purchases_status_idx').on(table.status),
    expenseCategoryIdx: index('purchases_expense_category_idx').on(table.expenseCategoryId),
    idempotencyKeyIdx: uniqueIndex('purchases_idempotency_key_idx').on(table.idempotencyKey),
  })
);

// Table 13: purchase_items
export const purchaseItems = pgTable(
  'purchase_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseId: uuid('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 14, scale: 0 }).notNull(),
    subtotal: numeric('subtotal', { precision: 14, scale: 0 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    quantityPositiveChk: check('chk_purchase_items_quantity_positive', sql`${table.quantity} > 0`),
    unitPriceNonNegativeChk: check('chk_purchase_items_unit_price_non_negative', sql`${table.unitPrice} >= 0`),
    subtotalNonNegativeChk: check('chk_purchase_items_subtotal_non_negative', sql`${table.subtotal} >= 0`),
    purchaseIdIdx: index('purchase_items_purchase_id_idx').on(table.purchaseId),
    itemIdIdx: index('purchase_items_item_id_idx').on(table.itemId),
  })
);

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type NewPurchaseItem = typeof purchaseItems.$inferInsert;
