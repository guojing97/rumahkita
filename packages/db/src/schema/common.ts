import { timestamp, uuid, numeric, pgEnum } from 'drizzle-orm/pg-core';

/**
 * Standard audit columns present on all primary business records
 */
export const auditColumns = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * Soft delete column helper for master data entities
 */
export const softDeleteColumn = {
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};

/**
 * Monetary IDR column helper (numeric 14, 0)
 */
export const idrNumeric = (name: string) => numeric(name, { precision: 14, scale: 0 });

/**
 * Shared payment method enum aligned with @rumahkita/contracts
 */
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer', 'ewallet', 'other']);
