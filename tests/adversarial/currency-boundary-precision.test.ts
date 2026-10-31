/**
 * Adversarial Test Suite: Currency Boundary & Precision Tests
 * Empirically tests max numeric(14,0) boundary (999,999,999,999), overflow rejection (1,000,000,000,000),
 * non-integer fractional rejection, and non-numeric/negative edge cases across all financial entities.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../e2e/client/auth-helper.ts';
import {
  createIncomeSourceFixture,
  createExpenseCategoryFixture,
  todayISO,
  randomString,
} from '../e2e/client/test-context.ts';

const MAX_IDR_NOMINAL = 999_999_999_999;
const OVERFLOW_IDR_NOMINAL = 1_000_000_000_000;

describe('Adversarial: Currency Boundary & Precision', () => {
  // -------------------------------------------------------------------------
  // 1. Maximum IDR Boundary (999,999,999,999) Exact Precision
  // -------------------------------------------------------------------------
  describe('Max Boundary: 999,999,999,999 IDR', () => {
    test('ADV-C1: Income accepts max nominal 999,999,999,999 without precision loss', async () => {
      const { client } = await getOwnerClient();
      const source = await createIncomeSourceFixture(client);

      const res = await client.post('/incomes', {
        sourceId: source.id,
        date: todayISO(),
        nominal: MAX_IDR_NOMINAL,
        notes: 'Penjualan Aset Properti Maksimal',
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      assert.strictEqual(Number(res.body.data.nominal), MAX_IDR_NOMINAL);

      // Verify retrieval from DB
      const getRes = await client.get(`/incomes/${res.body.data.id}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(Number(getRes.body.data.nominal), MAX_IDR_NOMINAL);
    });

    test('ADV-C2: Expense accepts max nominal 999,999,999,999 without precision loss', async () => {
      const { client } = await getOwnerClient();
      const category = await createExpenseCategoryFixture(client);

      const res = await client.post('/expenses', {
        categoryId: category.id,
        date: todayISO(),
        nominal: MAX_IDR_NOMINAL,
        paymentMethod: 'transfer',
        notes: 'Investasi Skala Besar',
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      assert.strictEqual(Number(res.body.data.nominal), MAX_IDR_NOMINAL);

      const getRes = await client.get(`/expenses/${res.body.data.id}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(Number(getRes.body.data.nominal), MAX_IDR_NOMINAL);
    });

    test('ADV-C3: Debt accepts max principal 999,999,999,999 without precision loss', async () => {
      const { client } = await getOwnerClient();

      const res = await client.post('/debts-receivables', {
        type: 'payable',
        partyName: `Kreditur Bank Mega ${randomString(4)}`,
        description: 'Kredit Korporasi Keluarga',
        principalAmount: MAX_IDR_NOMINAL,
        dueDate: '2030-12-31',
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      assert.strictEqual(Number(res.body.data.principalAmount), MAX_IDR_NOMINAL);
      assert.strictEqual(Number(res.body.data.remainingBalance), MAX_IDR_NOMINAL);

      const getRes = await client.get(`/debts-receivables/${res.body.data.id}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(Number(getRes.body.data.principalAmount), MAX_IDR_NOMINAL);
      assert.strictEqual(Number(getRes.body.data.remainingBalance), MAX_IDR_NOMINAL);
    });

    test('ADV-C4: Purchase draft and completion with max unitPrice 999,999,999,999', async () => {
      const { client } = await getOwnerClient();
      const category = await createExpenseCategoryFixture(client);

      const draftRes = await client.post('/purchases', {
        date: todayISO(),
        expenseCategoryId: category.id,
        vendor: 'Lelang Properti',
        items: [
          {
            itemName: 'Tanah Bangunan',
            quantity: 1,
            unitPrice: MAX_IDR_NOMINAL,
          },
        ],
      });

      assert.strictEqual(draftRes.status, 201);
      assert.strictEqual(Number(draftRes.body.data.totalAmount), MAX_IDR_NOMINAL);

      // Complete purchase
      const completeRes = await client.post(
        `/purchases/${draftRes.body.data.id}/complete`,
        {},
        { headers: { 'Idempotency-Key': `max-curr-${randomString(10)}` } }
      );
      assert.strictEqual(completeRes.status, 200);
      assert.strictEqual(Number(completeRes.body.data.totalAmount), MAX_IDR_NOMINAL);

      // Verify linked expense
      const expenseRes = await client.get(`/expenses/${completeRes.body.data.expenseId}`);
      assert.strictEqual(expenseRes.status, 200);
      assert.strictEqual(Number(expenseRes.body.data.nominal), MAX_IDR_NOMINAL);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Overflow Rejection (1,000,000,000,000 IDR)
  // -------------------------------------------------------------------------
  describe('Overflow Rejection: 1,000,000,000,000 IDR', () => {
    test('ADV-C5: Income with nominal >= 1,000,000,000,000 rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const source = await createIncomeSourceFixture(client);

      const res = await client.post('/incomes', {
        sourceId: source.id,
        date: todayISO(),
        nominal: OVERFLOW_IDR_NOMINAL,
      });

      assert.strictEqual(res.status, 422, `Expected 422 for overflow income, got ${res.status}`);
      assert.match(res.body?.message || '', /batas wajar|valid/i);
    });

    test('ADV-C6: Expense with nominal >= 1,000,000,000,000 rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const category = await createExpenseCategoryFixture(client);

      const res = await client.post('/expenses', {
        categoryId: category.id,
        date: todayISO(),
        nominal: OVERFLOW_IDR_NOMINAL,
      });

      assert.strictEqual(res.status, 422, `Expected 422 for overflow expense, got ${res.status}`);
      assert.match(res.body?.message || '', /batas wajar|valid/i);
    });

    test('ADV-C7: Debt with principalAmount >= 1,000,000,000,000 rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();

      const res = await client.post('/debts-receivables', {
        type: 'payable',
        partyName: 'Konglomerat',
        principalAmount: OVERFLOW_IDR_NOMINAL,
      });

      assert.strictEqual(res.status, 422, `Expected 422 for overflow debt, got ${res.status}`);
      assert.match(res.body?.message || '', /batas wajar|valid/i);
    });

    test('ADV-C8: Purchase item with unitPrice >= 1,000,000,000,000 rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const category = await createExpenseCategoryFixture(client);

      const res = await client.post('/purchases', {
        date: todayISO(),
        expenseCategoryId: category.id,
        items: [
          {
            itemName: 'Pulau Pribadi',
            quantity: 1,
            unitPrice: OVERFLOW_IDR_NOMINAL,
          },
        ],
      });

      assert.strictEqual(res.status, 422, `Expected 422 for overflow purchase item, got ${res.status}`);
      assert.match(res.body?.message || '', /batas wajar|valid/i);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Integer Integrity: Fractional IDR Rejection
  // -------------------------------------------------------------------------
  describe('Integer Currency Integrity (No Fractional IDR)', () => {
    test('ADV-C9: Fractional income nominal rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const source = await createIncomeSourceFixture(client);

      const res = await client.post('/incomes', {
        sourceId: source.id,
        date: todayISO(),
        nominal: 50000.75,
      });

      assert.strictEqual(res.status, 422, `Expected 422 for fractional nominal, got ${res.status}`);
      assert.match(res.body?.message || '', /bilangan bulat|valid/i);
    });

    test('ADV-C10: Fractional expense nominal rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const category = await createExpenseCategoryFixture(client);

      const res = await client.post('/expenses', {
        categoryId: category.id,
        date: todayISO(),
        nominal: 25000.5,
      });

      assert.strictEqual(res.status, 422, `Expected 422 for fractional nominal, got ${res.status}`);
      assert.match(res.body?.message || '', /bilangan bulat|valid/i);
    });

    test('ADV-C11: Fractional debt payment rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const debtRes = await client.post('/debts-receivables', {
        type: 'payable',
        partyName: `Kreditur ${randomString(4)}`,
        principalAmount: 100000,
      });

      const res = await client.post(`/debts-receivables/${debtRes.body.data.id}/payments`, {
        amount: 33333.33,
        paymentDate: todayISO(),
        paymentMethod: 'cash',
      });

      assert.strictEqual(res.status, 422, `Expected 422 for fractional payment, got ${res.status}`);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Non-Numeric & Negative Boundaries
  // -------------------------------------------------------------------------
  describe('Non-Numeric and Negative Input Boundaries', () => {
    test('ADV-C12: Negative and zero nominals reject with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const source = await createIncomeSourceFixture(client);
      const category = await createExpenseCategoryFixture(client);

      // Income zero
      const incZero = await client.post('/incomes', {
        sourceId: source.id,
        date: todayISO(),
        nominal: 0,
      });
      assert.strictEqual(incZero.status, 422);

      // Income negative
      const incNeg = await client.post('/incomes', {
        sourceId: source.id,
        date: todayISO(),
        nominal: -10000,
      });
      assert.strictEqual(incNeg.status, 422);

      // Expense zero
      const expZero = await client.post('/expenses', {
        categoryId: category.id,
        date: todayISO(),
        nominal: 0,
      });
      assert.strictEqual(expZero.status, 422);

      // Expense negative
      const expNeg = await client.post('/expenses', {
        categoryId: category.id,
        date: todayISO(),
        nominal: -50000,
      });
      assert.strictEqual(expNeg.status, 422);
    });

    test('ADV-C13: String non-numeric nominal rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const source = await createIncomeSourceFixture(client);

      const res = await client.post('/incomes', {
        sourceId: source.id,
        date: todayISO(),
        nominal: 'sejuta_rupiah',
      });

      assert.strictEqual(res.status, 422, `Expected 422 for non-numeric nominal, got ${res.status}`);
    });
  });
});
