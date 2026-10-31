import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  idrAmountSchema,
  optionalIdrAmountSchema,
  formatIDR,
  parseIDR,
  calculateStockStatus,
  evaluateStockThresholdTransition,
  loginSchema,
  registerSchema,
  inviteMemberSchema,
  forgotPasswordSchema,
  createIncomeSchema,
  createExpenseSchema,
  stockAdjustmentSchema,
  createDebtReceivableSchema,
  transactionQuerySchema,
  transactionItemSchema,
} from '../index.js';

describe('Contracts & Domain Logic Tests', () => {
  describe('IDR Currency Validation', () => {
    it('accepts valid positive integer Rupiah amounts', () => {
      const result = idrAmountSchema.safeParse(15000000);
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data, 15000000);
      }
    });

    it('rejects nominal <= 0', () => {
      const zeroResult = idrAmountSchema.safeParse(0);
      assert.equal(zeroResult.success, false);

      const negResult = idrAmountSchema.safeParse(-50000);
      assert.equal(negResult.success, false);
    });

    it('rejects decimal nominal (non-integers)', () => {
      const decResult = idrAmountSchema.safeParse(10500.75);
      assert.equal(decResult.success, false);
    });

    it('rejects booleans in idrAmountSchema and optionalIdrAmountSchema', () => {
      assert.equal(idrAmountSchema.safeParse(true).success, false);
      assert.equal(idrAmountSchema.safeParse(false).success, false);
      assert.equal(optionalIdrAmountSchema.safeParse(true).success, false);
      assert.equal(optionalIdrAmountSchema.safeParse(false).success, false);
    });

    it('handles optional IDR correctly without coercing null to zero', () => {
      const nullResult = optionalIdrAmountSchema.safeParse(null);
      assert.equal(nullResult.success, true);
      if (nullResult.success) {
        assert.equal(nullResult.data, undefined);
      }

      const emptyStrResult = optionalIdrAmountSchema.safeParse('');
      assert.equal(emptyStrResult.success, true);
      if (emptyStrResult.success) {
        assert.equal(emptyStrResult.data, undefined);
      }

      const undefResult = optionalIdrAmountSchema.safeParse(undefined);
      assert.equal(undefResult.success, true);
      if (undefResult.success) {
        assert.equal(undefResult.data, undefined);
      }

      const validResult = optionalIdrAmountSchema.safeParse(250000);
      assert.equal(validResult.success, true);
      if (validResult.success) {
        assert.equal(validResult.data, 250000);
      }
    });

    it('formats IDR cleanly with Intl formatter', () => {
      const formatted = formatIDR(1500000);
      assert.ok(formatted.includes('1.500.000'));
    });

    it('parses IDR strings cleanly handling decimal cents and separators', () => {
      assert.equal(parseIDR('Rp 150.000,00'), 150000);
      assert.equal(parseIDR('Rp 1.500.000,00'), 1500000);
      assert.equal(parseIDR('Rp 150.000,50'), 150000);
      assert.equal(parseIDR('150000'), 150000);
      assert.equal(parseIDR('Rp 25.000'), 25000);
      assert.equal(parseIDR('invalid'), 0);
    });
  });

  describe('Inventory Stock Status & Deduplication Transition', () => {
    it('accurately computes stock status', () => {
      assert.equal(calculateStockStatus(0, 2), 'OUT');
      assert.equal(calculateStockStatus(-1, 2), 'OUT');
      assert.equal(calculateStockStatus(2, 2), 'LOW');
      assert.equal(calculateStockStatus(1, 2), 'LOW');
      assert.equal(calculateStockStatus(5, 2), 'SAFE');
    });

    it('notifies on Safe -> Low transition', () => {
      const evalResult = evaluateStockThresholdTransition(5, 2, 2);
      assert.equal(evalResult.shouldNotify, true);
      assert.equal(evalResult.eventType, 'STOCK_LOW');
    });

    it('notifies on Safe -> Out transition', () => {
      const evalResult = evaluateStockThresholdTransition(5, 0, 2);
      assert.equal(evalResult.shouldNotify, true);
      assert.equal(evalResult.eventType, 'STOCK_OUT');
    });

    it('suppresses duplicate alert when item is already low', () => {
      const evalResult = evaluateStockThresholdTransition(2, 1, 2);
      assert.equal(evalResult.shouldNotify, false);
      assert.equal(evalResult.eventType, null);
    });

    it('suppresses alert when stock is replenished above threshold', () => {
      const evalResult = evaluateStockThresholdTransition(1, 6, 2);
      assert.equal(evalResult.shouldNotify, false);
      assert.equal(evalResult.eventType, null);
    });
  });

  describe('Auth Domain Schemas', () => {
    it('rejects invalid email and short password', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'short',
      });
      assert.equal(result.success, false);
    });

    it('accepts valid login credentials', () => {
      const result = loginSchema.safeParse({
        email: 'budi@rumahkita.local',
        password: 'Password123!',
      });
      assert.equal(result.success, true);
    });

    it('normalizes email with leading/trailing whitespace and mixed case', () => {
      const loginRes = loginSchema.safeParse({
        email: '  Budi@RumahKita.LOCAL  ',
        password: 'Password123!',
      });
      assert.equal(loginRes.success, true);
      if (loginRes.success) {
        assert.equal(loginRes.data.email, 'budi@rumahkita.local');
      }

      const registerRes = registerSchema.safeParse({
        email: '  NewUser@DOMAIN.com  ',
        password: 'Password123!',
        fullName: 'New User',
      });
      assert.equal(registerRes.success, true);
      if (registerRes.success) {
        assert.equal(registerRes.data.email, 'newuser@domain.com');
      }

      const inviteRes = inviteMemberSchema.safeParse({
        email: '  InviteMe@DOMAIN.COM  ',
      });
      assert.equal(inviteRes.success, true);
      if (inviteRes.success) {
        assert.equal(inviteRes.data.email, 'inviteme@domain.com');
      }

      const forgotRes = forgotPasswordSchema.safeParse({
        email: '  ResetMe@DOMAIN.COM  ',
      });
      assert.equal(forgotRes.success, true);
      if (forgotRes.success) {
        assert.equal(forgotRes.data.email, 'resetme@domain.com');
      }
    });

    it('rejects whitespace-only email', () => {
      const whitespaceEmail = loginSchema.safeParse({
        email: '   ',
        password: 'Password123!',
      });
      assert.equal(whitespaceEmail.success, false);
    });
  });

  describe('Financial Transaction Validation', () => {
    const validUuid = '0192e20b-0000-7000-8000-000000000001';

    it('rejects income with nominal <= 0 or missing sourceId', () => {
      const invalidIncome = createIncomeSchema.safeParse({
        date: '2026-10-27',
        nominal: 0,
        sourceId: validUuid,
      });
      assert.equal(invalidIncome.success, false);

      const missingSource = createIncomeSchema.safeParse({
        date: '2026-10-27',
        nominal: 100000,
      });
      assert.equal(missingSource.success, false);
    });

    it('rejects expense without categoryId', () => {
      const missingCategory = createExpenseSchema.safeParse({
        date: '2026-10-27',
        nominal: 50000,
      });
      assert.equal(missingCategory.success, false);
    });

    it('requires mandatory reason for stock adjustment', () => {
      const missingReason = stockAdjustmentSchema.safeParse({
        delta: -1,
        reason: '',
      });
      assert.equal(missingReason.success, false);

      const zeroDelta = stockAdjustmentSchema.safeParse({
        delta: 0,
        reason: 'Alasan koreksi',
      });
      assert.equal(zeroDelta.success, false);

      const validAdjustment = stockAdjustmentSchema.safeParse({
        delta: -2,
        reason: 'Barang rusak / bocor',
      });
      assert.equal(validAdjustment.success, true);
    });

    it('rejects whitespace-only stock adjustment reason', () => {
      const whitespaceReason = stockAdjustmentSchema.safeParse({
        delta: 5,
        reason: '   ',
      });
      assert.equal(whitespaceReason.success, false);

      const tabNewlineReason = stockAdjustmentSchema.safeParse({
        delta: -3,
        reason: ' \t \n ',
      });
      assert.equal(tabNewlineReason.success, false);
    });

    it('validates debt principal amount must be positive', () => {
      const invalidDebt = createDebtReceivableSchema.safeParse({
        type: 'payable',
        partyName: 'Pak RT',
        principalAmount: -500000,
      });
      assert.equal(invalidDebt.success, false);
    });
  });

  describe('Unified Transaction Contracts', () => {
    it('applies default pagination and type all', () => {
      const parsed = transactionQuerySchema.parse({});
      assert.equal(parsed.page, 1);
      assert.equal(parsed.limit, 20);
      assert.equal(parsed.type, 'all');
    });

    it('accepts valid transaction types and filters', () => {
      const parsed = transactionQuerySchema.parse({
        type: 'income',
        page: '2',
        limit: '50',
        search: 'gaji',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        categoryId: '00000000-0000-4000-a000-000000000201',
      });
      assert.equal(parsed.type, 'income');
      assert.equal(parsed.page, 2);
      assert.equal(parsed.limit, 50);
      assert.equal(parsed.search, 'gaji');
      assert.equal(parsed.startDate, '2026-01-01');
      assert.equal(parsed.endDate, '2026-12-31');
    });

    it('rejects invalid transaction type', () => {
      const invalid = transactionQuerySchema.safeParse({ type: 'invalid_type' });
      assert.equal(invalid.success, false);
    });

    it('validates transactionItemSchema structure', () => {
      const validItem = transactionItemSchema.safeParse({
        id: '00000000-0000-4000-a000-000000000101',
        type: 'income',
        date: '2026-10-28',
        nominal: 15000000,
        categoryName: 'Gaji',
        sourceName: 'Gaji Bulanan',
        paymentMethod: null,
        notes: 'Gaji bulan Oktober',
        createdAt: new Date().toISOString(),
      });
      assert.equal(validItem.success, true);
    });
  });
});
