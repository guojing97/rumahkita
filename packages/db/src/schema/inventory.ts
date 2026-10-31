import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { households } from './household';

export const stockMovementReasonEnum = pgEnum('stock_movement_reason', [
  'purchase',
  'manual_correction',
  'waste',
  'initial',
  'reversal',
]);

// Table 10: items
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    category: varchar('category', { length: 100 }),
    unit: varchar('unit', { length: 30 }).notNull(),
    quantityOnHand: integer('quantity_on_hand').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
    location: varchar('location', { length: 100 }),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    stockNonNegativeChk: check('chk_items_quantity_on_hand_non_negative', sql`${table.quantityOnHand} >= 0`),
    thresholdNonNegativeChk: check('chk_items_low_stock_threshold_non_negative', sql`${table.lowStockThreshold} >= 0`),
    householdIdx: index('items_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('items_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 11: stock_movements
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    quantityDelta: integer('quantity_delta').notNull(),
    resultingQuantity: integer('resulting_quantity').notNull(),
    reason: stockMovementReasonEnum('reason').notNull(),
    notes: text('notes'),
    referenceId: uuid('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    deltaNonZeroChk: check('chk_stock_movements_delta_non_zero', sql`${table.quantityDelta} != 0`),
    resultingNonNegativeChk: check('chk_stock_movements_resulting_non_negative', sql`${table.resultingQuantity} >= 0`),
    itemCreatedIdx: index('stock_movements_item_created_idx').on(table.itemId, table.createdAt),
    householdIdx: index('stock_movements_household_idx').on(table.householdId),
    referenceIdIdx: index('stock_movements_reference_id_idx').on(table.referenceId),
  })
);

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
