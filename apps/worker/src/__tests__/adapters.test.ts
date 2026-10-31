import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EmailAdapter } from '../adapters/email.adapter';
import { WhatsAppAdapter } from '../adapters/whatsapp.adapter';
import { AdapterFactory } from '../adapters/index';

describe('EmailAdapter', () => {
  const adapter = new EmailAdapter('RumahKita <notifikasi@rumahkita.local>');

  it('validates valid email addresses', () => {
    assert.equal(adapter.validateRecipient('budi@rumahkita.local'), true);
    assert.equal(adapter.validateRecipient('ani.member@example.co.id'), true);
  });

  it('rejects invalid email addresses', () => {
    assert.equal(adapter.validateRecipient('invalid-email'), false);
    assert.equal(adapter.validateRecipient('@domain.com'), false);
    assert.equal(adapter.validateRecipient(''), false);
  });

  it('formats Indonesian email for STOCK_OUT event', () => {
    const formatted = adapter.formatEmailContent({
      eventId: 'evt-1',
      recipient: 'budi@rumahkita.local',
      eventType: 'STOCK_OUT',
      payload: {
        itemId: 'item-1',
        itemName: 'Beras Ramos',
        unit: 'kg',
        currentStock: 0,
        threshold: 5,
        timestamp: '2026-10-28T02:00:00.000Z',
      },
    });

    assert.ok(formatted.subject.includes('PERINGATAN: Stok Barang Habis (Beras Ramos)'));
    assert.ok(formatted.body.includes('Beras Ramos'));
    assert.ok(formatted.body.includes('0 kg'));
    assert.ok(formatted.body.includes('Batas Minimum: 5 kg'));
  });

  it('formats Indonesian email for STOCK_LOW event', () => {
    const formatted = adapter.formatEmailContent({
      eventId: 'evt-2',
      recipient: 'ani@rumahkita.local',
      eventType: 'STOCK_LOW',
      payload: {
        itemId: 'item-2',
        itemName: 'Minyak Goreng',
        unit: 'pouch',
        currentStock: 2,
        threshold: 3,
        timestamp: '2026-10-28T02:00:00.000Z',
      },
    });

    assert.ok(formatted.subject.includes('Peringatan: Stok Barang Menipis (Minyak Goreng)'));
    assert.ok(formatted.body.includes('Sisa Stok: 2 pouch'));
    assert.ok(formatted.body.includes('Batas Minimum: 3 pouch'));
  });

  it('sends email successfully stubbed with messageId', async () => {
    const res = await adapter.send({
      eventId: 'evt-3',
      recipient: 'valid.user@example.com',
      eventType: 'STOCK_LOW',
      payload: {
        itemId: 'item-3',
        itemName: 'Gula Pasir',
        unit: 'kg',
        currentStock: 1,
        threshold: 2,
        timestamp: '2026-10-28T02:00:00.000Z',
      },
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId?.startsWith('msg_email_'));
  });

  it('throws error when simulated failure recipient is provided', async () => {
    await assert.rejects(
      async () => {
        await adapter.send({
          eventId: 'evt-4',
          recipient: 'fail@rumahkita.local',
          eventType: 'STOCK_LOW',
          payload: {
            itemId: 'item-4',
            itemName: 'Gula Pasir',
            unit: 'kg',
            currentStock: 1,
            threshold: 2,
            timestamp: '2026-10-28T02:00:00.000Z',
          },
        });
      },
      {
        message: /Simulated email delivery failure/,
      }
    );
  });
});

describe('WhatsAppAdapter', () => {
  const adapter = new WhatsAppAdapter();

  it('normalizes Indonesian phone numbers to E.164 (+62...) format', () => {
    assert.equal(adapter.normalizePhoneNumber('081234567890'), '+6281234567890');
    assert.equal(adapter.normalizePhoneNumber('6281234567890'), '+6281234567890');
    assert.equal(adapter.normalizePhoneNumber('+6281234567890'), '+6281234567890');
    assert.equal(adapter.normalizePhoneNumber('0812-3456-7890'), '+6281234567890');
  });

  it('validates normalized phone numbers with regex', () => {
    assert.equal(adapter.validateRecipient('+6281234567890'), true);
    assert.equal(adapter.validateRecipient('+628999999999'), true);
    assert.equal(adapter.validateRecipient('+1234567890'), false); // non-+62
    assert.equal(adapter.validateRecipient('+62123'), false); // too short
  });

  it('formats Indonesian WhatsApp message for STOCK_OUT', () => {
    const msg = adapter.formatMessage({
      eventId: 'evt-wa-1',
      recipient: '+6281234567890',
      eventType: 'STOCK_OUT',
      payload: {
        itemId: 'item-wa-1',
        itemName: 'Telur Ayam',
        unit: 'butir',
        currentStock: 0,
        threshold: 10,
        timestamp: '2026-10-28T02:00:00.000Z',
      },
    });

    assert.ok(msg.includes('Stok "Telur Ayam" HABIS (0 butir)'));
  });

  it('formats Indonesian WhatsApp message for STOCK_LOW', () => {
    const msg = adapter.formatMessage({
      eventId: 'evt-wa-2',
      recipient: '+6281234567890',
      eventType: 'STOCK_LOW',
      payload: {
        itemId: 'item-wa-2',
        itemName: 'Kopi Bubuk',
        unit: 'bungkus',
        currentStock: 2,
        threshold: 5,
        timestamp: '2026-10-28T02:00:00.000Z',
      },
    });

    assert.ok(msg.includes('Stok "Kopi Bubuk" menipis (sisa: 2 bungkus, minimum: 5 bungkus)'));
  });

  it('sends WhatsApp notification successfully', async () => {
    const res = await adapter.send({
      eventId: 'evt-wa-3',
      recipient: '081234567890',
      eventType: 'STOCK_LOW',
      payload: {
        itemId: 'item-wa-3',
        itemName: 'Garam Dapur',
        unit: 'bungkus',
        currentStock: 1,
        threshold: 2,
        timestamp: '2026-10-28T02:00:00.000Z',
      },
    });

    assert.equal(res.success, true);
    assert.ok(res.messageId?.startsWith('msg_wa_'));
  });

  it('throws error when simulated failure phone is provided', async () => {
    await assert.rejects(
      async () => {
        await adapter.send({
          eventId: 'evt-wa-4',
          recipient: '+629999999999',
          eventType: 'STOCK_LOW',
          payload: {
            itemId: 'item-wa-4',
            itemName: 'Garam Dapur',
            unit: 'bungkus',
            currentStock: 1,
            threshold: 2,
            timestamp: '2026-10-28T02:00:00.000Z',
          },
        });
      },
      {
        message: /Simulated WhatsApp delivery failure/,
      }
    );
  });
});

describe('AdapterFactory', () => {
  const factory = new AdapterFactory();

  it('resolves EmailAdapter for EMAIL channel', () => {
    const adapter = factory.getAdapter('EMAIL');
    assert.ok(adapter instanceof EmailAdapter);
  });

  it('resolves WhatsAppAdapter for WHATSAPP channel', () => {
    const adapter = factory.getAdapter('WHATSAPP');
    assert.ok(adapter instanceof WhatsAppAdapter);
  });

  it('throws for unsupported channel', () => {
    assert.throws(() => factory.getAdapter('TELEGRAM'), {
      message: /Unsupported notification channel: TELEGRAM/,
    });
  });
});
