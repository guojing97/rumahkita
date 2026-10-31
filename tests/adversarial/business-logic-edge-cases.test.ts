/**
 * Adversarial Test Suite: Business Logic Edge Cases
 * Tests stock adjustment boundaries, race conditions, debt payment constraints, and lifecycle transitions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../e2e/client/auth-helper.ts';
import {
  createItemFixture,
  createDebtReceivableFixture,
  todayISO,
  randomString,
} from '../e2e/client/test-context.ts';

describe('Adversarial: Business Logic Edge Cases', () => {
  // -------------------------------------------------------------------------
  // Stock Adjustment Edge Cases
  // -------------------------------------------------------------------------
  describe('Stock Adjustment Invariants', () => {
    test('ADV-S1: Negative stock prevention: adjustment reducing stock below 0 rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const item = await createItemFixture(client, { quantityOnHand: 10, lowStockThreshold: 3 });

      // Attempt delta -11 (10 - 11 = -1 < 0)
      const res = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -11,
        reason: 'Pemakaian berlebih tidak valid',
      });

      assert.strictEqual(res.status, 422, `Expected 422 Unprocessable Entity, got ${res.status}`);
      assert.match(
        res.body?.message || '',
        /negatif|tidak mencukupi|valid/i,
        'Error message should indicate negative stock prevention'
      );

      // Verify stock untouched
      const itemVerify = await client.get(`/items/${item.id}`);
      assert.strictEqual(Number(itemVerify.body.data.quantityOnHand), 10);
    });

    test('ADV-S2: Stock adjustment missing or invalid reason rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const item = await createItemFixture(client, { quantityOnHand: 10 });

      // 1. Missing reason field
      const res1 = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -2,
      });
      assert.strictEqual(res1.status, 422, `Expected 422 for missing reason, got ${res1.status}`);

      // 2. Empty string reason
      const res2 = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -2,
        reason: '',
      });
      assert.strictEqual(res2.status, 422, `Expected 422 for empty reason, got ${res2.status}`);

      // 3. Whitespace-only reason
      const res3 = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -2,
        reason: '   ',
      });
      assert.strictEqual(res3.status, 422, `Expected 422 for whitespace reason, got ${res3.status}`);

      // 4. Too short reason (< 3 chars)
      const res4 = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -2,
        reason: 'ok',
      });
      assert.strictEqual(res4.status, 422, `Expected 422 for reason < 3 chars, got ${res4.status}`);

      // Verify stock was not modified
      const itemVerify = await client.get(`/items/${item.id}`);
      assert.strictEqual(Number(itemVerify.body.data.quantityOnHand), 10);
    });

    test('ADV-S3: Stock adjustment with delta = 0 rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const item = await createItemFixture(client, { quantityOnHand: 10 });

      const res = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: 0,
        reason: 'Penyesuaian tanpa perubahan',
      });
      assert.strictEqual(res.status, 422, `Expected 422 for delta=0, got ${res.status}`);
    });

    test('ADV-S4: Stock exact boundaries: transition to Habis (qty=0) and Menipis (qty=threshold)', async () => {
      const { client } = await getOwnerClient();
      const item = await createItemFixture(client, { quantityOnHand: 10, lowStockThreshold: 4 });

      // Step 1: Reduce stock to exactly threshold (10 - 6 = 4) -> Menipis
      const resThreshold = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -6,
        reason: 'Konsumsi normal mingguan',
      });
      assert.strictEqual(resThreshold.status, 200);
      assert.strictEqual(resThreshold.body.data.newQuantity, 4);
      assert.strictEqual(resThreshold.body.data.status, 'Menipis');

      // Verify via GET
      const verifyThreshold = await client.get(`/items/${item.id}`);
      assert.strictEqual(Number(verifyThreshold.body.data.quantityOnHand), 4);
      assert.strictEqual(verifyThreshold.body.data.status, 'Menipis');

      // Step 2: Reduce stock from 4 to exactly 0 (4 - 4 = 0) -> Habis
      const resZero = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -4,
        reason: 'Konsumsi habis total',
      });
      assert.strictEqual(resZero.status, 200);
      assert.strictEqual(resZero.body.data.newQuantity, 0);
      assert.strictEqual(resZero.body.data.status, 'Habis');

      // Verify via GET
      const verifyZero = await client.get(`/items/${item.id}`);
      assert.strictEqual(Number(verifyZero.body.data.quantityOnHand), 0);
      assert.strictEqual(verifyZero.body.data.status, 'Habis');
    });

    test('ADV-S5: Concurrent stock reduction race condition prevents negative stock', async () => {
      const { client } = await getOwnerClient();
      const item = await createItemFixture(client, { quantityOnHand: 10 });

      // Item has 10 units. Fire 3 concurrent requests each consuming 6 units (total requested 18).
      // Only 1 request can succeed (leaving 4 units); the other 2 must fail with 422 because 4 - 6 = -2 < 0.
      const promises = Array.from({ length: 3 }).map((_, i) =>
        client.post(`/items/${item.id}/stock-adjustments`, {
          delta: -6,
          reason: `Konsumsi paralel ${i + 1}`,
        })
      );

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200).length;
      const rejectedCount = statuses.filter((s) => s === 422).length;

      assert.strictEqual(successCount, 1, `Exactly 1 concurrent reduction should succeed, got ${successCount}`);
      assert.strictEqual(rejectedCount, 2, `Other 2 reductions must reject with 422, got ${rejectedCount}`);

      const itemVerify = await client.get(`/items/${item.id}`);
      assert.strictEqual(
        Number(itemVerify.body.data.quantityOnHand),
        4,
        `Final stock must be exactly 4 (10 - 6). Got ${itemVerify.body.data.quantityOnHand}`
      );
    });
  });

  // -------------------------------------------------------------------------
  // Debt & Receivable Repayment Edge Cases
  // -------------------------------------------------------------------------
  describe('Debt & Receivable Repayment Invariants', () => {
    test('ADV-D1: Payment exceeding remaining balance rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const debt = await createDebtReceivableFixture(client, {
        type: 'payable',
        partyName: `Kreditur ${randomString(5)}`,
        principalAmount: 500000,
      });

      // Attempt payment of 500,001 (exceeds balance 500,000)
      const res = await client.post(`/debts-receivables/${debt.id}/payments`, {
        amount: 500001,
        paymentDate: todayISO(),
        paymentMethod: 'transfer',
      });

      assert.strictEqual(res.status, 422, `Expected 422 for overpayment, got ${res.status}`);
      assert.match(
        res.body?.message || '',
        /melebihi|sisa saldo|valid/i,
        'Error should state payment exceeds balance'
      );

      // Verify balance unchanged
      const verifyRes = await client.get(`/debts-receivables/${debt.id}`);
      assert.strictEqual(Number(verifyRes.body.data.remainingBalance), 500000);
      assert.strictEqual(verifyRes.body.data.status, 'open');
    });

    test('ADV-D2: Non-positive payment amount (0 or negative) rejects with HTTP 422', async () => {
      const { client } = await getOwnerClient();
      const debt = await createDebtReceivableFixture(client, {
        principalAmount: 300000,
      });

      // Amount = 0
      const resZero = await client.post(`/debts-receivables/${debt.id}/payments`, {
        amount: 0,
        paymentDate: todayISO(),
        paymentMethod: 'cash',
      });
      assert.strictEqual(resZero.status, 422, `Expected 422 for amount=0, got ${resZero.status}`);

      // Amount < 0
      const resNegative = await client.post(`/debts-receivables/${debt.id}/payments`, {
        amount: -50000,
        paymentDate: todayISO(),
        paymentMethod: 'cash',
      });
      assert.strictEqual(resNegative.status, 422, `Expected 422 for negative amount, got ${resNegative.status}`);
    });

    test('ADV-D3: Multi-stage lifecycle: open -> partially_paid -> settled -> reject further payments', async () => {
      const { client } = await getOwnerClient();
      const principal = 400000;
      const debt = await createDebtReceivableFixture(client, {
        type: 'payable',
        partyName: `Toko Cat ${randomString(4)}`,
        principalAmount: principal,
      });

      // 1. Initial State
      const initialGet = await client.get(`/debts-receivables/${debt.id}`);
      assert.strictEqual(Number(initialGet.body.data.principalAmount), principal);
      assert.strictEqual(Number(initialGet.body.data.remainingBalance), principal);
      assert.strictEqual(initialGet.body.data.status, 'open');

      // 2. Partial Payment (150,000) -> partially_paid (remaining: 250,000)
      const pay1 = await client.post(`/debts-receivables/${debt.id}/payments`, {
        amount: 150000,
        paymentDate: todayISO(),
        paymentMethod: 'transfer',
        notes: 'Cicilan 1',
      });
      assert.strictEqual(pay1.status, 200);
      assert.strictEqual(pay1.body.data.remainingBalance, 250000);
      assert.strictEqual(pay1.body.data.status, 'partially_paid');

      // Verify via GET
      const get1 = await client.get(`/debts-receivables/${debt.id}`);
      assert.strictEqual(Number(get1.body.data.remainingBalance), 250000);
      assert.strictEqual(get1.body.data.status, 'partially_paid');

      // 3. Exact Balance Payment (250,000) -> settled (remaining: 0)
      const pay2 = await client.post(`/debts-receivables/${debt.id}/payments`, {
        amount: 250000,
        paymentDate: todayISO(),
        paymentMethod: 'transfer',
        notes: 'Pelunasan',
      });
      assert.strictEqual(pay2.status, 200);
      assert.strictEqual(pay2.body.data.remainingBalance, 0);
      assert.strictEqual(pay2.body.data.status, 'settled');

      // Verify via GET
      const get2 = await client.get(`/debts-receivables/${debt.id}`);
      assert.strictEqual(Number(get2.body.data.remainingBalance), 0);
      assert.strictEqual(get2.body.data.status, 'settled');
      assert.strictEqual(get2.body.data.payments.length, 2);

      // 4. Attempt payment on already settled debt -> HTTP 422
      const payAfterSettled = await client.post(`/debts-receivables/${debt.id}/payments`, {
        amount: 50000,
        paymentDate: todayISO(),
        paymentMethod: 'transfer',
      });
      assert.strictEqual(
        payAfterSettled.status,
        422,
        `Expected 422 for payment on settled debt, got ${payAfterSettled.status}`
      );
    });

    test('ADV-D4: Concurrent payment race condition prevents double payment exceeding balance', async () => {
      const { client } = await getOwnerClient();
      const debt = await createDebtReceivableFixture(client, {
        principalAmount: 100000,
      });

      // Balance is 100,000. Send 3 concurrent payments of 70,000 each (total 210,000).
      // Exactly 1 can succeed (leaving 30,000); the other 2 must fail with 422.
      const promises = Array.from({ length: 3 }).map((_, i) =>
        client.post(`/debts-receivables/${debt.id}/payments`, {
          amount: 70000,
          paymentDate: todayISO(),
          paymentMethod: 'transfer',
          notes: `Bayar konkuren ${i + 1}`,
        })
      );

      const results = await Promise.all(promises);
      const statuses = results.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200).length;
      const rejectedCount = statuses.filter((s) => s === 422).length;

      assert.strictEqual(successCount, 1, `Exactly 1 concurrent payment should succeed, got ${successCount}`);
      assert.strictEqual(rejectedCount, 2, `Other 2 payments must be rejected with 422, got ${rejectedCount}`);

      const debtVerify = await client.get(`/debts-receivables/${debt.id}`);
      assert.strictEqual(
        Number(debtVerify.body.data.remainingBalance),
        30000,
        `Remaining balance must be 30000 (100000 - 70000). Got ${debtVerify.body.data.remainingBalance}`
      );
    });
  });
});
