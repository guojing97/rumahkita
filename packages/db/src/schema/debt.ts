import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  date,
  pgEnum,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { households } from './household';
import { paymentMethodEnum } from './common';

export const debtTypeEnum = pgEnum('debt_type', ['payable', 'receivable']);
export const debtStatusEnum = pgEnum('debt_status', ['open', 'partially_paid', 'settled', 'overdue', 'cancelled']);

// Table 14: debts_receivables
export const debtsReceivables = pgTable(
  'debts_receivables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    type: debtTypeEnum('type').notNull(),
    partyName: varchar('party_name', { length: 150 }).notNull(),
    description: text('description'),
    principalAmount: numeric('principal_amount', { precision: 14, scale: 0 }).notNull(),
    remainingBalance: numeric('remaining_balance', { precision: 14, scale: 0 }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    status: debtStatusEnum('status').notNull().default('open'),
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
    principalPositiveChk: check('chk_debts_principal_positive', sql`${table.principalAmount} > 0`),
    balanceNonNegativeChk: check('chk_debts_balance_non_negative', sql`${table.remainingBalance} >= 0`),
    householdIdx: index('debts_receivables_household_idx').on(table.householdId),
    dueDateIdx: index('debts_receivables_due_date_idx').on(table.dueDate),
    statusIdx: index('debts_receivables_status_idx').on(table.status),
    householdTypeStatusIdx: index('debts_receivables_household_type_status_idx').on(
      table.householdId,
      table.type,
      table.status
    ),
  })
);

// Table 15: debt_receivable_payments
export const debtReceivablePayments = pgTable(
  'debt_receivable_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    debtReceivableId: uuid('debt_receivable_id')
      .notNull()
      .references(() => debtsReceivables.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 14, scale: 0 }).notNull(),
    paymentDate: date('payment_date', { mode: 'string' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('transfer'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    amountPositiveChk: check('chk_debt_payments_amount_positive', sql`${table.amount} > 0`),
    debtReceivableIdx: index('debt_payments_debt_receivable_idx').on(table.debtReceivableId),
    paymentDateIdx: index('debt_payments_payment_date_idx').on(table.paymentDate),
  })
);

export type DebtReceivable = typeof debtsReceivables.$inferSelect;
export type NewDebtReceivable = typeof debtsReceivables.$inferInsert;
export type DebtReceivablePayment = typeof debtReceivablePayments.$inferSelect;
export type NewDebtReceivablePayment = typeof debtReceivablePayments.$inferInsert;
