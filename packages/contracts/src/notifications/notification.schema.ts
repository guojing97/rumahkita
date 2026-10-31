import { z } from 'zod';

export const notificationChannelEnum = z.enum(['EMAIL', 'WHATSAPP']);
export type NotificationChannel = z.infer<typeof notificationChannelEnum>;

export const notificationStatusEnum = z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED']);
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;

export const notificationPreferenceSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  userId: z.string().uuid(),
  emailEnabled: z.boolean(),
  emailAddress: z.string().email().nullable().optional(),
  whatsappEnabled: z.boolean(),
  whatsappNumber: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export const updateNotificationPreferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  emailAddress: z.string().email('Format email tidak valid').nullable().optional(),
  whatsappEnabled: z.boolean().optional(),
  whatsappNumber: z
    .string()
    .regex(/^\+62[0-9]{8,15}$/, 'Format nomor WhatsApp harus diawali +62 (contoh: +628123456789)')
    .nullable()
    .optional(),
});

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;

export const notificationEventPayloadSchema = z.object({
  itemId: z.string().uuid(),
  itemName: z.string(),
  unit: z.string(),
  currentStock: z.number().int(),
  threshold: z.number().int(),
  timestamp: z.string(),
});

export type NotificationEventPayload = z.infer<typeof notificationEventPayloadSchema>;

export const notificationEventResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  itemId: z.string().uuid().nullable().optional(),
  eventType: z.string(),
  payload: notificationEventPayloadSchema,
  status: notificationStatusEnum,
  channel: notificationChannelEnum,
  recipient: z.string(),
  attempts: z.number().int(),
  maxAttempts: z.number().int(),
  lastError: z.string().nullable().optional(),
  nextRetryAt: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export type NotificationEventResponse = z.infer<typeof notificationEventResponseSchema>;
