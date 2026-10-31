import { relations } from 'drizzle-orm';
import { users, refreshSessions } from './auth';
import { households, householdMembers } from './household';
import { incomeSources, incomeCategories, expenseCategories, incomes, expenses } from './finance';
import { items, stockMovements } from './inventory';
import { purchases, purchaseItems } from './purchase';
import { debtsReceivables, debtReceivablePayments } from './debt';
import { notificationPreferences, notificationEvents } from './notification';
import { auditLogs } from './audit';

// Users Relations
export const usersRelations = relations(users, ({ many }) => ({
  householdMembers: many(householdMembers),
  refreshSessions: many(refreshSessions),
  notificationPreferences: many(notificationPreferences),
}));

// Refresh Sessions Relations
export const refreshSessionsRelations = relations(refreshSessions, ({ one }) => ({
  user: one(users, {
    fields: [refreshSessions.userId],
    references: [users.id],
  }),
}));

// Households Relations
export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  incomeSources: many(incomeSources),
  incomeCategories: many(incomeCategories),
  expenseCategories: many(expenseCategories),
  incomes: many(incomes),
  expenses: many(expenses),
  items: many(items),
  stockMovements: many(stockMovements),
  purchases: many(purchases),
  debtsReceivables: many(debtsReceivables),
  notificationPreferences: many(notificationPreferences),
  notificationEvents: many(notificationEvents),
  auditLogs: many(auditLogs),
}));

// Household Members Relations
export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdMembers.userId],
    references: [users.id],
  }),
}));

// Income Sources Relations
export const incomeSourcesRelations = relations(incomeSources, ({ one, many }) => ({
  household: one(households, {
    fields: [incomeSources.householdId],
    references: [households.id],
  }),
  incomes: many(incomes),
  creator: one(users, {
    fields: [incomeSources.createdBy],
    references: [users.id],
  }),
}));

// Income Categories Relations
export const incomeCategoriesRelations = relations(incomeCategories, ({ one, many }) => ({
  household: one(households, {
    fields: [incomeCategories.householdId],
    references: [households.id],
  }),
  incomes: many(incomes),
}));

// Expense Categories Relations
export const expenseCategoriesRelations = relations(expenseCategories, ({ one, many }) => ({
  household: one(households, {
    fields: [expenseCategories.householdId],
    references: [households.id],
  }),
  expenses: many(expenses),
  purchases: many(purchases),
}));

// Incomes Relations
export const incomesRelations = relations(incomes, ({ one }) => ({
  household: one(households, {
    fields: [incomes.householdId],
    references: [households.id],
  }),
  source: one(incomeSources, {
    fields: [incomes.sourceId],
    references: [incomeSources.id],
  }),
  category: one(incomeCategories, {
    fields: [incomes.categoryId],
    references: [incomeCategories.id],
  }),
  creator: one(users, {
    fields: [incomes.createdBy],
    references: [users.id],
  }),
}));

// Expenses Relations
export const expensesRelations = relations(expenses, ({ one }) => ({
  household: one(households, {
    fields: [expenses.householdId],
    references: [households.id],
  }),
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  purchase: one(purchases, {
    fields: [expenses.purchaseId],
    references: [purchases.id],
  }),
  creator: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
  }),
}));

// Items Relations
export const itemsRelations = relations(items, ({ one, many }) => ({
  household: one(households, {
    fields: [items.householdId],
    references: [households.id],
  }),
  stockMovements: many(stockMovements),
  purchaseItems: many(purchaseItems),
  notificationEvents: many(notificationEvents),
}));

// Stock Movements Relations
export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  household: one(households, {
    fields: [stockMovements.householdId],
    references: [households.id],
  }),
  item: one(items, {
    fields: [stockMovements.itemId],
    references: [items.id],
  }),
  creator: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
  }),
}));

// Purchases Relations
export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  household: one(households, {
    fields: [purchases.householdId],
    references: [households.id],
  }),
  expenseCategory: one(expenseCategories, {
    fields: [purchases.expenseCategoryId],
    references: [expenseCategories.id],
  }),
  items: many(purchaseItems),
  expense: one(expenses, {
    fields: [purchases.id],
    references: [expenses.purchaseId],
  }),
  creator: one(users, {
    fields: [purchases.createdBy],
    references: [users.id],
  }),
}));

// Purchase Items Relations
export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  item: one(items, {
    fields: [purchaseItems.itemId],
    references: [items.id],
  }),
}));

// Debts / Receivables Relations
export const debtsReceivablesRelations = relations(debtsReceivables, ({ one, many }) => ({
  household: one(households, {
    fields: [debtsReceivables.householdId],
    references: [households.id],
  }),
  payments: many(debtReceivablePayments),
  creator: one(users, {
    fields: [debtsReceivables.createdBy],
    references: [users.id],
  }),
}));

// Debt Payments Relations
export const debtReceivablePaymentsRelations = relations(debtReceivablePayments, ({ one }) => ({
  debtReceivable: one(debtsReceivables, {
    fields: [debtReceivablePayments.debtReceivableId],
    references: [debtsReceivables.id],
  }),
  creator: one(users, {
    fields: [debtReceivablePayments.createdBy],
    references: [users.id],
  }),
}));

// Notification Preferences Relations
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  household: one(households, {
    fields: [notificationPreferences.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

// Notification Events Relations
export const notificationEventsRelations = relations(notificationEvents, ({ one }) => ({
  household: one(households, {
    fields: [notificationEvents.householdId],
    references: [households.id],
  }),
  item: one(items, {
    fields: [notificationEvents.itemId],
    references: [items.id],
  }),
}));

// Audit Logs Relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  household: one(households, {
    fields: [auditLogs.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
