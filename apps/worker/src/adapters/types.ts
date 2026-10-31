import type { NotificationEventPayload } from '@rumahkita/contracts';

export interface SendNotificationOptions {
  eventId: string;
  recipient: string;
  eventType: string; // 'STOCK_LOW' | 'STOCK_OUT'
  payload: NotificationEventPayload;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationAdapter {
  send(options: SendNotificationOptions): Promise<SendResult>;
}
