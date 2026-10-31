import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { households } from './household';
import { purchases } from './purchase';
import { paymentMethodEnum } from './common';

export { paymentMethodEnum };

// Table 5: income_sources
export const incomeSources = pgTable(
  'income_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    householdIdx: index('income_sources_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('income_sources_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 6: income_categories
export const incomeCategories = pgTable(
  'income_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    householdIdx: index('income_categories_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('income_categories_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 7: expense_categories
export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 20 }),
    budgetLimit: numeric('budget_limit', { precision: 14, scale: 0 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    householdIdx: index('expense_categories_household_idx').on(table.householdId),
    uniqueNamePerHousehold: uniqueIndex('expense_categories_household_name_idx')
      .on(table.householdId, table.name)
      .where(sql`deleted_at IS NULL`),
  })
);

// Table 8: incomes
export const incomes = pgTable(
  'incomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => incomeSources.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => incomeCategories.id, { onDelete: 'set null' }),
    date: date('date', { mode: 'string' }).notNull(),
    nominal: numeric('nominal', { precision: 14, scale: 0 }).notNull(),
    notes: text('notes'),
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
    nominalPositiveChk: check('chk_incomes_nominal_positive', sql`${table.nominal} > 0`),
    householdDateIdx: index('incomes_household_date_idx').on(table.householdId, table.date),
    sourceIdIdx: index('incomes_source_id_idx').on(table.sourceId),
    categoryIdIdx: index('incomes_category_id_idx').on(table.categoryId),
  })
);

// Table 9: expenses
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    purchaseId: uuid('purchase_id').references((): AnyPgColumn => purchases.id, { onDelete: 'set null' }),
    date: date('date', { mode: 'string' }).notNull(),
    nominal: numeric('nominal', { precision: 14, scale: 0 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('cash'),
    notes: text('notes'),
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
    nominalPositiveChk: check('chk_expenses_nominal_positive', sql`${table.nominal} > 0`),
    householdDateIdx: index('expenses_household_date_idx').on(table.householdId, table.date),
    categoryIdIdx: index('expenses_category_id_idx').on(table.categoryId),
    purchaseIdIdx: index('expenses_purchase_id_idx').on(table.purchaseId),
  })
);

export type IncomeSource = typeof incomeSources.$inferSelect;
export type NewIncomeSource = typeof incomeSources.$inferInsert;
export type IncomeCategory = typeof incomeCategories.$inferSelect;
export type NewIncomeCategory = typeof incomeCategories.$inferInsert;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;
export type Income = typeof incomes.$inferSelect;
export type NewIncome = typeof incomes.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
