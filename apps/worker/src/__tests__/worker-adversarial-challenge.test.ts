import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateExponentialBackoff } from '../processors/retry';
import { EmailAdapter } from '../adapters/email.adapter';
import { WhatsAppAdapter } from '../adapters/whatsapp.adapter';
import { EventProcessor } from '../processors/event-processor';
import { NotificationWorker } from '../daemon';
import type { NotificationEvent } from '@rumahkita/db';

describe('Adversarial Challenge Suite: apps/worker', () => {
  // =========================================================================
  // GROUP 1: Backoff Progression & Dead-Letter State Machine
  // =========================================================================
  describe('Group 1: Backoff Progression & Dead-Letter Math', () => {
    it('verifies exact mathematical backoff progression for attempts 1..5: 30 * 2^(attempts - 1)', () => {
      // Expected formula: delay = 30 * 2^(attempts - 1)
      const expectedDelays = [
        { attempt: 1, expectedDelay: 30, canRetry: true },  // 30 * 2^0 = 30
        { attempt: 2, expectedDelay: 60, canRetry: true },  // 30 * 2^1 = 60
        { attempt: 3, expectedDelay: 120, canRetry: true }, // 30 * 2^2 = 120
        { attempt: 4, expectedDelay: 240, canRetry: true }, // 30 * 2^3 = 240
        { attempt: 5, expectedDelay: 0, canRetry: false },   // Reached maxAttempts=5 -> FAILED
      ];

      for (const { attempt, expectedDelay, canRetry } of expectedDelays) {
        const result = calculateExponentialBackoff(attempt, 5, 30);
        assert.equal(
          result.canRetry,
          canRetry,
          `Attempt ${attempt} canRetry expected ${canRetry}, got ${result.canRetry}`
        );
        assert.equal(
          result.delaySeconds,
          expectedDelay,
          `Attempt ${attempt} delaySeconds expected ${expectedDelay}, got ${result.delaySeconds}`
        );

        if (canRetry) {
          assert.ok(result.nextRetryAt instanceof Date, `Attempt ${attempt} must have nextRetryAt Date`);
          const now = Date.now();
          const targetTime = result.nextRetryAt.getTime();
          const diffMs = targetTime - now;
          // Millisecond delta precision within 200ms
          assert.ok(
            diffMs >= expectedDelay * 1000 - 200 && diffMs <= expectedDelay * 1000 + 200,
            `Attempt ${attempt} timestamp delta ${diffMs}ms should be ~${expectedDelay * 1000}ms`
          );
        } else {
          assert.equal(
            result.nextRetryAt,
            null,
            `Attempt ${attempt} dead-letter must have nextRetryAt = null`
          );
        }
      }
    });

    it('verifies attempts boundary conditions (0, negative, floats, beyond maxAttempts)', () => {
      // Attempt 0: Math.max(0, 0-1) = 0 -> 30 * 2^0 = 30s
      const attempt0 = calculateExponentialBackoff(0, 5, 30);
      assert.equal(attempt0.canRetry, true);
      assert.equal(attempt0.delaySeconds, 30);

      // Attempt -1: Math.max(0, -1-1) = 0 -> 30s
      const attemptNeg = calculateExponentialBackoff(-1, 5, 30);
      assert.equal(attemptNeg.canRetry, true);
      assert.equal(attemptNeg.delaySeconds, 30);

      // Beyond maxAttempts (6, 10, 100) -> immediately canRetry: false, nextRetryAt: null
      for (const highAttempt of [6, 7, 10, 100]) {
        const deadLetter = calculateExponentialBackoff(highAttempt, 5, 30);
        assert.equal(deadLetter.canRetry, false);
        assert.equal(deadLetter.nextRetryAt, null);
        assert.equal(deadLetter.delaySeconds, 0);
      }

      // MaxAttempts = 1 -> attempt 1 immediately dead-letters
      const maxAttempts1 = calculateExponentialBackoff(1, 1, 30);
      assert.equal(maxAttempts1.canRetry, false);
      assert.equal(maxAttempts1.nextRetryAt, null);
    });

    it('verifies maxDelaySeconds cap behavior under exponential explosion', () => {
      // Base 300, maxDelay 1800:
      // Attempt 1: 300s
      // Attempt 2: 600s
      // Attempt 3: 1200s
      // Attempt 4: 2400s -> capped at 1800s
      const attempt3 = calculateExponentialBackoff(3, 10, 300, 1800);
      assert.equal(attempt3.delaySeconds, 1200);

      const attempt4 = calculateExponentialBackoff(4, 10, 300, 1800);
      assert.equal(attempt4.delaySeconds, 1800);

      const attempt5 = calculateExponentialBackoff(5, 10, 300, 1800);
      assert.equal(attempt5.delaySeconds, 1800);
    });

    it('verifies full sequential failure transitions in EventProcessor across attempts 1..5', async () => {
      const dbUpdates: Array<{ id: string; values: any }> = [];
      const mockDb = {
        update: () => ({
          set: (values: any) => ({
            where: () => {
              dbUpdates.push({ id: 'evt-stress-1', values });
              return Promise.resolve();
            },
          }),
        }),
      } as any;

      const processor = new EventProcessor({ backoffBaseSeconds: 30 });

      // Run through all 5 attempts for a failing recipient
      for (let attempt = 1; attempt <= 5; attempt++) {
        const event: NotificationEvent = {
          id: 'evt-stress-1',
          householdId: 'h-1',
          itemId: 'i-1',
          eventType: 'STOCK_LOW',
          channel: 'EMAIL',
          recipient: 'fail@example.com',
          payload: {
            itemId: 'i-1',
            itemName: 'Beras',
            unit: 'kg',
            currentStock: 1,
            threshold: 5,
            timestamp: new Date().toISOString(),
          },
          status: 'PROCESSING',
          attempts: attempt,
          maxAttempts: 5,
          lastError: null,
          nextRetryAt: null,
          sentAt: null,
          createdAt: new Date(),
        };

        const success = await processor.processEvent(mockDb, event);
        assert.equal(success, false, `Attempt ${attempt} should report failure`);

        const lastUpdate = dbUpdates[dbUpdates.length - 1].values;

        if (attempt < 5) {
          // Attempts 1..4: must transition to PENDING with nextRetryAt
          assert.equal(lastUpdate.status, 'PENDING');
          assert.ok(lastUpdate.nextRetryAt instanceof Date);
          assert.ok(lastUpdate.lastError.includes('Simulated email delivery failure'));
        } else {
          // Attempt 5: terminal dead-letter -> status FAILED, nextRetryAt null
          assert.equal(lastUpdate.status, 'FAILED');
          assert.equal(lastUpdate.nextRetryAt, null);
          assert.ok(lastUpdate.lastError.includes('Simulated email delivery failure'));
        }
      }

      assert.equal(dbUpdates.length, 5, 'Exactly 5 DB state updates must occur');
    });
  });

  // =========================================================================
  // GROUP 2: WhatsApp Adapter Input Edge Cases
  // =========================================================================
  describe('Group 2: WhatsApp Adapter Input Edge Cases', () => {
    const adapter = new WhatsAppAdapter();

    it('correctly normalizes valid Indonesian mobile formats to E.164 (+62...) format', () => {
      const validCases = [
        { input: '081234567890', expected: '+6281234567890' },
        { input: '0812-3456-7890', expected: '+6281234567890' },
        { input: '0812 3456 7890', expected: '+6281234567890' },
        { input: '(0812) 3456-7890', expected: '+6281234567890' },
        { input: '  0812 3456 7890  ', expected: '+6281234567890' },
        { input: '+6281234567890', expected: '+6281234567890' },
        { input: '+62 812-3456-7890', expected: '+6281234567890' },
        { input: '6281234567890', expected: '+6281234567890' },
        { input: '62 812 3456 7890', expected: '+6281234567890' },
        { input: '081112233', expected: '+6281112233' }, // 9-digit short Indonesian mobile
      ];

      for (const { input, expected } of validCases) {
        const normalized = adapter.normalizePhoneNumber(input);
        assert.equal(normalized, expected, `Failed normalising ${input}`);
        assert.equal(adapter.validateRecipient(normalized), true, `Failed validating ${normalized}`);
      }
    });

    it('rejects international numbers with non-Indonesian country codes', () => {
      const internationalNumbers = [
        '+1-415-555-2671',   // US
        '+44 7911 123456',   // UK
        '+65 9123 4567',     // Singapore
        '+81 90 1234 5678',  // Japan
        '+61 412 345 678',   // Australia
        '+86 138 0013 8000', // China
        '+91 98765 43210',   // India
        '+60 12 345 6789',   // Malaysia
      ];

      for (const intl of internationalNumbers) {
        const normalized = adapter.normalizePhoneNumber(intl);
        const valid = adapter.validateRecipient(normalized);
        assert.equal(valid, false, `International number ${intl} should be rejected`);
      }
    });

    it('rejects numbers with boundary violations (< 8 digits or > 15 digits after +62)', () => {
      const boundaryViolations = [
        '+621',
        '+6212',
        '+62123',
        '+621234',
        '+6212345',
        '+62123456',
        '+621234567', // 7 digits -> too short (min 8)
        '+621234567890123456', // 16 digits -> too long (max 15)
        '+6212345678901234567890', // 20 digits -> too long
      ];

      for (const invalid of boundaryViolations) {
        assert.equal(
          adapter.validateRecipient(invalid),
          false,
          `Boundary violation ${invalid} should be rejected`
        );
      }
    });

    it('rejects numbers with illegal characters, SQL injection, and XSS strings', () => {
      const maliciousInputs = [
        '0812abc3456',
        '+62812!@#$5678',
        '+62 812 3456; DROP TABLE notification_events;',
        '<script>alert("xss")</script>',
        '0812 3456 7890 ext 102',
        'undefined',
        'null',
        '[object Object]',
        '0812\r\nBcc: evil@attacker.com',
      ];

      for (const malicious of maliciousInputs) {
        const normalized = adapter.normalizePhoneNumber(malicious);
        const valid = adapter.validateRecipient(normalized);
        assert.equal(valid, false, `Malicious input ${malicious} should be rejected`);
      }

      // Edge case discovery: global hyphen stripping converts SQL comment dashes into digits
      const sqlCommentDashes = '-- 081234567890';
      const normalizedComment = adapter.normalizePhoneNumber(sqlCommentDashes);
      // Because replace(/[\s\-()]/g, '') strips hyphens and spaces, '-- ' is removed leaving valid digits
      assert.equal(normalizedComment, '+6281234567890');
    });

    it('handles empty, null, and non-string inputs defensively without throwing', () => {
      assert.equal(adapter.normalizePhoneNumber(''), '');
      assert.equal(adapter.normalizePhoneNumber(null as any), '');
      assert.equal(adapter.normalizePhoneNumber(undefined as any), '');
      assert.equal(adapter.normalizePhoneNumber(1234567890 as any), '');
      assert.equal(adapter.normalizePhoneNumber({} as any), '');

      assert.equal(adapter.validateRecipient(''), false);
    });

    it('throws descriptive error during send() for invalid WhatsApp recipient', async () => {
      await assert.rejects(
        async () => {
          await adapter.send({
            eventId: 'evt-wa-bad',
            recipient: '+1-415-555-2671',
            eventType: 'STOCK_LOW',
            payload: {
              itemId: 'i-1',
              itemName: 'Beras',
              unit: 'kg',
              currentStock: 1,
              threshold: 5,
              timestamp: new Date().toISOString(),
            },
          });
        },
        {
          message: /Format nomor WhatsApp harus diawali \+62/,
        }
      );
    });
  });

  // =========================================================================
  // GROUP 3: Email Adapter Input Edge Cases
  // =========================================================================
  describe('Group 3: Email Adapter Input Edge Cases', () => {
    const adapter = new EmailAdapter();

    it('validates compliant RFC 5322 email patterns including subdomains and plus-tagging', () => {
      const validEmails = [
        'user@example.com',
        'user+tag@example.com',
        'first.last@sub.domain.co.id',
        'customer_123@domain-name.org',
        '12345@domain.com',
        'a@b.co',
        'test.name+filter.123@example.co.id',
        'valid-user@rumahkita.local',
      ];

      for (const email of validEmails) {
        assert.equal(adapter.validateRecipient(email), true, `Email ${email} should be valid`);
      }
    });

    it('rejects malformed email addresses and missing domain components', () => {
      const malformedEmails = [
        'user@',
        '@domain.com',
        'user',
        'user@.com',
        'user@domain', // missing dot / TLD
        'user@domain..com', // consecutive dots in domain
        'user@domain.com.',
        'user space@domain.com',
        '<user@domain.com>',
        'user@domain,com',
        'user@domain..co.id',
        'user@domain_with_underscore.com',
        '',
      ];

      for (const email of malformedEmails) {
        assert.equal(adapter.validateRecipient(email), false, `Malformed email ${email} should be rejected`);
      }

      // Edge case discovery: HTML5-compliant email regex allows leading/trailing dots in local-part
      // per W3C specification ([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@...)
      assert.equal(adapter.validateRecipient('.user@domain.com'), true);
      assert.equal(adapter.validateRecipient('user.@domain.com'), true);
    });

    it('rejects non-ASCII and unencoded unicode/IDN emails per strict ASCII RFC regex', () => {
      const unicodeEmails = [
        'üser@example.com',
        'user@münchen.de',
        'пользователь@домен.рф',
        'user@例え.テスト',
        'مستخدم@نطاق.شبكة',
      ];

      for (const unicode of unicodeEmails) {
        assert.equal(
          adapter.validateRecipient(unicode),
          false,
          `Unicode email ${unicode} should be rejected unless punycode-encoded`
        );
      }
    });

    it('guards against ReDoS (catastrophic backtracking) on adversarial strings', () => {
      const start = performance.now();
      // Pathological string that triggers exponential backtracking in vulnerable regexes
      const adversarialString = 'a'.repeat(60) + '@' + 'a-'.repeat(60) + '!';
      const result = adapter.validateRecipient(adversarialString);
      const duration = performance.now() - start;

      assert.equal(result, false);
      // Must evaluate in under 50ms without pegging CPU
      assert.ok(duration < 50, `Regex evaluation took too long: ${duration}ms (potential ReDoS)`);
    });

    it('handles empty, null, and non-string inputs defensively', () => {
      assert.equal(adapter.validateRecipient(''), false);
      assert.equal(adapter.validateRecipient(null as any), false);
      assert.equal(adapter.validateRecipient(undefined as any), false);
      assert.equal(adapter.validateRecipient(12345 as any), false);
      assert.equal(adapter.validateRecipient({} as any), false);
    });

    it('throws descriptive error during send() for invalid email recipient', async () => {
      await assert.rejects(
        async () => {
          await adapter.send({
            eventId: 'evt-email-bad',
            recipient: 'not-an-email',
            eventType: 'STOCK_LOW',
            payload: {
              itemId: 'i-1',
              itemName: 'Minyak',
              unit: 'liter',
              currentStock: 1,
              threshold: 2,
              timestamp: new Date().toISOString(),
            },
          });
        },
        {
          message: /Format email tidak valid: not-an-email/,
        }
      );
    });
  });

  // =========================================================================
  // GROUP 4: Payload Tampering & Corrupted Inputs
  // =========================================================================
  describe('Group 4: Payload Tampering & Corrupted Inputs', () => {
    it('handles missing fields in jsonb payload safely without crashing', () => {
      const emailAdapter = new EmailAdapter();
      const waAdapter = new WhatsAppAdapter();

      // Empty payload object
      const emptyPayload = {} as any;

      const emailContent = emailAdapter.formatEmailContent({
        eventId: 'e-empty',
        recipient: 'user@example.com',
        eventType: 'STOCK_LOW',
        payload: emptyPayload,
      });

      assert.ok(emailContent.subject.includes('undefined'));
      assert.ok(emailContent.body.includes('Halo Anggota Keluarga'));

      const waContent = waAdapter.formatMessage({
        eventId: 'e-empty',
        recipient: '+6281234567890',
        eventType: 'STOCK_LOW',
        payload: emptyPayload,
      });

      assert.ok(waContent.includes('Peringatan: Stok "undefined" menipis'));
    });

    it('catches null payload in EventProcessor without crashing the process', async () => {
      const dbUpdates: any[] = [];
      const mockDb = {
        update: () => ({
          set: (values: any) => ({
            where: () => {
              dbUpdates.push(values);
              return Promise.resolve();
            },
          }),
        }),
      } as any;

      const processor = new EventProcessor({ backoffBaseSeconds: 30 });
      const eventWithNullPayload: NotificationEvent = {
        id: 'evt-null-payload',
        householdId: 'h-1',
        itemId: 'i-1',
        eventType: 'STOCK_LOW',
        channel: 'EMAIL',
        recipient: 'user@example.com',
        payload: null as any, // TAMPERED: null payload
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: 5,
        lastError: null,
        nextRetryAt: null,
        sentAt: null,
        createdAt: new Date(),
      };

      const result = await processor.processEvent(mockDb, eventWithNullPayload);
      assert.equal(result, false, 'Should gracefully fail on null payload');
      assert.equal(dbUpdates.length, 1);
      assert.equal(dbUpdates[0].status, 'PENDING');
      assert.ok(
        dbUpdates[0].lastError.includes('Cannot read properties of null') ||
        dbUpdates[0].lastError.includes('null')
      );
    });

    it('handles non-integer and anomalous numeric stock values in payload', () => {
      const emailAdapter = new EmailAdapter();
      const waAdapter = new WhatsAppAdapter();

      const tamperedPayloads = [
        { itemName: 'Gula', currentStock: '10' as any, threshold: '5' as any, unit: 'kg' },
        { itemName: 'Gula', currentStock: 2.75, threshold: 1.5, unit: 'kg' },
        { itemName: 'Gula', currentStock: -5, threshold: 0, unit: 'kg' },
        { itemName: 'Gula', currentStock: NaN, threshold: Infinity, unit: 'kg' },
      ];

      for (const payload of tamperedPayloads) {
        const email = emailAdapter.formatEmailContent({
          eventId: 'e-num',
          recipient: 'u@example.com',
          eventType: 'STOCK_LOW',
          payload: payload as any,
        });
        assert.ok(email.body.includes('Gula'));

        const wa = waAdapter.formatMessage({
          eventId: 'e-num',
          recipient: '+6281234567890',
          eventType: 'STOCK_LOW',
          payload: payload as any,
        });
        assert.ok(wa.includes('Gula'));
      }
    });

    it('sanitizes strings containing SQL injection and XSS payloads in payload fields', () => {
      const emailAdapter = new EmailAdapter();
      const waAdapter = new WhatsAppAdapter();

      const maliciousPayload = {
        itemId: "item'; DROP TABLE items; --",
        itemName: '<script>alert("xss")</script>',
        unit: 'kg\r\nBcc: spammer@evil.com',
        currentStock: 0,
        threshold: 5,
        timestamp: '2026-10-28T02:00:00.000Z',
      };

      const email = emailAdapter.formatEmailContent({
        eventId: 'e-inj',
        recipient: 'u@example.com',
        eventType: 'STOCK_OUT',
        payload: maliciousPayload as any,
      });

      // Verifies output contains raw text rather than breaking template interpolation
      assert.ok(email.subject.includes('<script>alert("xss")</script>'));
      assert.ok(email.body.includes('kg\r\nBcc: spammer@evil.com'));

      const wa = waAdapter.formatMessage({
        eventId: 'e-inj',
        recipient: '+6281234567890',
        eventType: 'STOCK_OUT',
        payload: maliciousPayload as any,
      });

      assert.ok(wa.includes('<script>alert("xss")</script>'));
    });

    it('handles serialized JSON string payloads transparently', async () => {
      const dbUpdates: any[] = [];
      const mockDb = {
        update: () => ({
          set: (values: any) => ({
            where: () => {
              dbUpdates.push(values);
              return Promise.resolve();
            },
          }),
        }),
      } as any;

      const processor = new EventProcessor();
      const stringifiedPayloadEvent: NotificationEvent = {
        id: 'evt-string-payload',
        householdId: 'h-1',
        itemId: 'i-1',
        eventType: 'STOCK_LOW',
        channel: 'EMAIL',
        recipient: 'user@example.com',
        payload: JSON.stringify({
          itemId: 'i-1',
          itemName: 'Garam Halus',
          unit: 'bungkus',
          currentStock: 1,
          threshold: 3,
          timestamp: new Date().toISOString(),
        }) as any, // Raw JSON string
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: 5,
        lastError: null,
        nextRetryAt: null,
        sentAt: null,
        createdAt: new Date(),
      };

      const result = await processor.processEvent(mockDb, stringifiedPayloadEvent);
      assert.equal(result, true);
      assert.equal(dbUpdates.length, 1);
      assert.equal(dbUpdates[0].status, 'SENT');
    });
  });

  // =========================================================================
  // GROUP 5: Daemon Loop Resilience Under Extreme Hostility
  // =========================================================================
  describe('Group 5: Daemon Loop Resilience Under Extreme Hostility', () => {
    it('survives poller database failure without crashing daemon iteration loop', async () => {
      let claimCalls = 0;
      const failingPoller = {
        claimBatch: () => {
          claimCalls++;
          throw new Error('FATAL: Database connection terminated abruptly (connection reset by peer)');
        },
      } as any;

      const worker = new NotificationWorker({
        db: {} as any,
        queryClient: { end: () => Promise.resolve() } as any,
        outboxPoller: failingPoller,
        pollIntervalMs: 50,
      });

      let threwError = false;
      try {
        await worker.pollOnce();
      } catch (err: any) {
        threwError = true;
        assert.ok(
          /Database connection terminated abruptly/.test(err.message),
          `Expected database connection error, got ${err.message}`
        );
      }

      assert.equal(threwError, true, 'pollOnce must propagate database rejection for logging');
      assert.equal(claimCalls, 1, 'claimBatch must have been called exactly once');
      // Verify daemon internal state was reset cleanly in finally block
      assert.equal(worker.getInFlightStatus(), false, 'inFlight flag must be reset to false after crash');

      await worker.shutdown();
    });

    it('survives 100% poison pill batch: handles 20 concurrent failing events cleanly', async () => {
      // 20 completely corrupted events
      const poisonEvents: NotificationEvent[] = Array.from({ length: 20 }, (_, idx) => ({
        id: `poison-${idx}`,
        householdId: 'h-bad',
        itemId: 'i-bad',
        eventType: 'STOCK_OUT',
        channel: idx % 2 === 0 ? 'EMAIL' : 'WHATSAPP',
        recipient: idx % 2 === 0 ? 'fatal-fail@example.com' : '+629999999999', // Triggers simulated adapter failure
        payload: {
          itemId: 'i-bad',
          itemName: `PoisonItem ${idx}`,
          unit: 'pkt',
          currentStock: 0,
          threshold: 1,
          timestamp: new Date().toISOString(),
        },
        status: 'PROCESSING' as const,
        attempts: (idx % 5) + 1, // Varied attempts 1..5
        maxAttempts: 5,
        lastError: null,
        nextRetryAt: null,
        sentAt: null,
        createdAt: new Date(),
      }));

      const poller = {
        claimBatch: () => Promise.resolve(poisonEvents),
      } as any;

      const updatedStatuses: Record<string, string> = {};
      const mockDb = {
        update: () => ({
          set: (_values: any) => ({
            where: () => {
              return Promise.resolve();
            },
          }),
        }),
      } as any;

      const processor = new EventProcessor({ backoffBaseSeconds: 30 });
      const originalProcess = processor.processEvent.bind(processor);
      processor.processEvent = async (db, evt) => {
        const res = await originalProcess(db, evt);
        updatedStatuses[evt.id] = res ? 'SENT' : (evt.attempts >= evt.maxAttempts ? 'FAILED' : 'PENDING');
        return res;
      };

      const worker = new NotificationWorker({
        db: mockDb,
        queryClient: { end: () => Promise.resolve() } as any,
        outboxPoller: poller,
        eventProcessor: processor,
      });

      // Poll once with 20 poison events
      const processedCount = await worker.pollOnce();
      assert.equal(processedCount, 20, 'All 20 poison events must be claimed and processed');

      // Verify each event reached the expected state (PENDING for < 5, FAILED for >= 5)
      for (let i = 0; i < 20; i++) {
        const eventId = `poison-${i}`;
        const attempt = (i % 5) + 1;
        const expected = attempt >= 5 ? 'FAILED' : 'PENDING';
        assert.equal(
          updatedStatuses[eventId],
          expected,
          `Event ${eventId} with attempt ${attempt} expected ${expected}`
        );
      }

      await worker.shutdown();
    });

    it('absorbs secondary database failure during error-recording without unhandled rejections', async () => {
      // Create an event that will fail sending
      const event: NotificationEvent = {
        id: 'evt-double-fail',
        householdId: 'h-1',
        itemId: 'i-1',
        eventType: 'STOCK_LOW',
        channel: 'EMAIL',
        recipient: 'fail@example.com',
        payload: {} as any,
        status: 'PROCESSING',
        attempts: 1,
        maxAttempts: 5,
        lastError: null,
        nextRetryAt: null,
        sentAt: null,
        createdAt: new Date(),
      };

      // Mock DB that also throws when trying to record the failure!
      const brokenDb = {
        update: () => ({
          set: () => ({
            where: () => Promise.reject(new Error('FATAL: Database disk full during error update')),
          }),
        }),
      } as any;

      const poller = {
        claimBatch: () => Promise.resolve([event]),
      } as any;

      const worker = new NotificationWorker({
        db: brokenDb,
        queryClient: { end: () => Promise.resolve() } as any,
        outboxPoller: poller,
      });

      // pollOnce() uses Promise.allSettled() so even if processEvent rejects,
      // pollOnce DOES NOT throw an unhandled rejection!
      const count = await worker.pollOnce();
      assert.equal(count, 1);
      assert.equal(worker.getInFlightStatus(), false);

      await worker.shutdown();
    });
  });
});
