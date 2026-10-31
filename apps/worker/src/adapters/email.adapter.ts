import { NotificationAdapter, SendNotificationOptions, SendResult } from './types';

// RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class EmailAdapter implements NotificationAdapter {
  private readonly fromAddress: string;

  constructor(fromAddress: string = process.env.NOTIFICATION_FROM_EMAIL || 'RumahKita <notifikasi@rumahkita.local>') {
    this.fromAddress = fromAddress;
  }

  public validateRecipient(recipient: string): boolean {
    if (!recipient || typeof recipient !== 'string') {
      return false;
    }
    return EMAIL_REGEX.test(recipient.trim());
  }

  public formatEmailContent(options: SendNotificationOptions): { subject: string; body: string } {
    const { eventType, payload } = options;
    const isOutOfStock = eventType === 'STOCK_OUT';

    const subject = isOutOfStock
      ? `[RumahKita] PERINGATAN: Stok Barang Habis (${payload.itemName})`
      : `[RumahKita] Peringatan: Stok Barang Menipis (${payload.itemName})`;

    const body = isOutOfStock
      ? [
          'Halo Anggota Keluarga RumahKita,',
          '',
          'Perhatian, stok inventori rumah tangga Anda telah habis!',
          `Barang: ${payload.itemName}`,
          `Stok Saat Ini: 0 ${payload.unit}`,
          `Batas Minimum: ${payload.threshold} ${payload.unit}`,
          `Waktu Terdeteksi: ${payload.timestamp}`,
          '',
          'Silakan segera tambahkan ke daftar belanja kebutuhan rumah tangga Anda.',
        ].join('\n')
      : [
          'Halo Anggota Keluarga RumahKita,',
          '',
          'Perhatian, stok inventori rumah tangga Anda berada pada batas minimum.',
          `Barang: ${payload.itemName}`,
          `Sisa Stok: ${payload.currentStock} ${payload.unit}`,
          `Batas Minimum: ${payload.threshold} ${payload.unit}`,
          `Waktu Terdeteksi: ${payload.timestamp}`,
          '',
          'Disarankan untuk segera melakukan pembelian ulang sebelum kehabisan.',
        ].join('\n');

    return { subject, body };
  }

  public async send(options: SendNotificationOptions): Promise<SendResult> {
    const { eventId, recipient } = options;

    if (!this.validateRecipient(recipient)) {
      throw new Error(`Format email tidak valid: ${recipient}`);
    }

    // Deterministic simulation hook for testing failure/retry scenarios
    if (recipient.toLowerCase().includes('fail') || recipient.toLowerCase().includes('error')) {
      throw new Error(`Simulated email delivery failure for recipient: ${recipient}`);
    }

    const { subject, body } = this.formatEmailContent(options);
    const messageId = `msg_email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log(
      '[Worker][Email] Notification delivered:',
      JSON.stringify({
        eventId,
        messageId,
        channel: 'EMAIL',
        from: this.fromAddress,
        recipient: recipient.trim().toLowerCase(),
        subject,
        bodyPreview: body.substring(0, 100),
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
