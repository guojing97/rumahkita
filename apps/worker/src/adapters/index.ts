import { EmailAdapter } from './email.adapter';
import { WhatsAppAdapter } from './whatsapp.adapter';
import { NotificationAdapter } from './types';

export * from './types';
export * from './email.adapter';
export * from './whatsapp.adapter';

export class AdapterFactory {
  private readonly emailAdapter: EmailAdapter;
  private readonly whatsappAdapter: WhatsAppAdapter;

  constructor(emailAdapter?: EmailAdapter, whatsappAdapter?: WhatsAppAdapter) {
    this.emailAdapter = emailAdapter || new EmailAdapter();
    this.whatsappAdapter = whatsappAdapter || new WhatsAppAdapter();
  }

  public getAdapter(channel: string): NotificationAdapter {
    const normalized = channel.toUpperCase();
    if (normalized === 'EMAIL') {
      return this.emailAdapter;
    }
    if (normalized === 'WHATSAPP') {
      return this.whatsappAdapter;
    }
    throw new Error(`Unsupported notification channel: ${channel}`);
  }
}
