import { NotificationAdapter, SendNotificationOptions, SendResult } from './types';

const E164_WA_REGEX = /^\+62[0-9]{8,15}$/;

export class WhatsAppAdapter implements NotificationAdapter {
  /**
   * Normalizes an Indonesian phone number to E.164 format (+62...).
   * Examples:
   *  - '081234567890' -> '+6281234567890'
   *  - '6281234567890' -> '+6281234567890'
   *  - '+6281234567890' -> '+6281234567890'
   *  - '0812-3456-7890' -> '+6281234567890'
   */
  public normalizePhoneNumber(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      return '';
    }

    // Strip whitespace, hyphens, and parentheses
    const cleaned = phone.trim().replace(/[\s\-()]/g, '');

    if (cleaned.startsWith('+62')) {
      return cleaned;
    }
    if (cleaned.startsWith('62')) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('0')) {
      return `+62${cleaned.substring(1)}`;
    }

    return cleaned;
  }

  public validateRecipient(normalizedPhone: string): boolean {
    return E164_WA_REGEX.test(normalizedPhone);
  }

  public formatMessage(options: SendNotificationOptions): string {
    const { eventType, payload } = options;
    const isOutOfStock = eventType === 'STOCK_OUT';

    if (isOutOfStock) {
      return `[RumahKita] Peringatan: Stok "${payload.itemName}" HABIS (0 ${payload.unit}). Segera lakukan pembelian ulang.`;
    }

    return `[RumahKita] Peringatan: Stok "${payload.itemName}" menipis (sisa: ${payload.currentStock} ${payload.unit}, minimum: ${payload.threshold} ${payload.unit}). Segera lakukan pembelian ulang.`;
  }

  public async send(options: SendNotificationOptions): Promise<SendResult> {
    const { eventId, recipient } = options;
    const normalizedPhone = this.normalizePhoneNumber(recipient);

    if (!this.validateRecipient(normalizedPhone)) {
      throw new Error(
        `Format nomor WhatsApp harus diawali +62 (contoh: +628123456789): ${recipient}`
      );
    }

    // Deterministic simulation hook for testing failure/retry scenarios
    if (
      normalizedPhone.includes('999999999') ||
      recipient.toLowerCase().includes('fail') ||
      recipient.toLowerCase().includes('error')
    ) {
      throw new Error(`Simulated WhatsApp delivery failure for recipient: ${recipient}`);
    }

    const message = this.formatMessage(options);
    const messageId = `msg_wa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log(
      '[Worker][WhatsApp] Notification delivered:',
      JSON.stringify({
        eventId,
        messageId,
        channel: 'WHATSAPP',
        recipient: normalizedPhone,
        message,
        status: 'DELIVERED_STUB',
        timestamp: new Date().toISOString(),
      })
    );

    return {
      success: true,
      messageId,
    };
  }
}
