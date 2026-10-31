import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { households } from './household';
import { items } from './inventory';

export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'WHATSAPP']);
export const notificationStatusEnum = pgEnum('notification_status', [
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED',
]);

// Table 16: notification_preferences
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    emailAddress: varchar('email_address', { length: 255 }),
    whatsappEnabled: boolean('whatsapp_enabled').notNull().default(false),
    whatsappNumber: varchar('whatsapp_number', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    householdUserIdx: uniqueIndex('notification_preferences_household_user_idx').on(
      table.householdId,
      table.userId
    ),
    userIdIdx: index('notification_preferences_user_id_idx').on(table.userId),
  })
);

// Table 17: notification_events (Transactional Outbox)
export const notificationEvents = pgTable(
  'notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    channel: notificationChannelEnum('channel').notNull().default('EMAIL'),
    recipient: varchar('recipient', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: notificationStatusEnum('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true, mode: 'date' }),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    outboxPollingIdx: index('notification_events_outbox_polling_idx').on(
      table.status,
      table.nextRetryAt,
      table.createdAt
    ),
    householdIdx: index('notification_events_household_idx').on(table.householdId),
    itemIdIdx: index('notification_events_item_id_idx').on(table.itemId),
  })
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NewNotificationEvent = typeof notificationEvents.$inferInsert;
