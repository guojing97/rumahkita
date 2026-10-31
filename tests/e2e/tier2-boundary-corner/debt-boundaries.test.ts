/**
 * Tier 2: Debts & Receivables Boundaries Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createDebtReceivableFixture, todayISO } from '../client/test-context.ts';

describe('Tier 2: Debts & Receivables Boundary Cases', () => {
  test('T2.10: Recording a payment exceeding the remaining balance returns 422', async () => {
    const { client } = await getOwnerClient();
    // Debt balance = 500,000
    const debt = await createDebtReceivableFixture(client, { principalAmount: 500000 });

    // Attempt to pay 600,000
    const res = await client.post(`/debts-receivables/${debt.id}/payments`, {
      paymentDate: todayISO(),
      amount: 600000,
      notes: 'Overpaying debt',
    });

    assert.strictEqual(
      res.status,
      422,
      `Expected 422 for payment exceeding balance, got ${res.status}`
    );
    assert.strictEqual(res.body.success, false);
  });

  test('T2.11: Recording a payment with amount <= 0 returns 422', async () => {
    const { client } = await getOwnerClient();
    const debt = await createDebtReceivableFixture(client, { principalAmount: 500000 });

    const resZero = await client.post(`/debts-receivables/${debt.id}/payments`, {
      paymentDate: todayISO(),
      amount: 0,
    });
    assert.strictEqual(resZero.status, 422);

    const resNegative = await client.post(`/debts-receivables/${debt.id}/payments`, {
      paymentDate: todayISO(),
      amount: -100000,
    });
    assert.strictEqual(resNegative.status, 422);
  });

  test('T2.12: Payment matching exact remaining balance transitions status to Settled', async () => {
    const { client } = await getOwnerClient();
    const debt = await createDebtReceivableFixture(client, { principalAmount: 250000 });

    // Pay full 250,000
    const res = await client.post(`/debts-receivables/${debt.id}/payments`, {
      paymentDate: todayISO(),
      amount: 250000,
      paymentMethod: 'transfer',
      notes: 'Pelunasan penuh',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(Number(res.body.data.remainingBalance), 0);
    assert.strictEqual(res.body.data.status, 'settled');

    // Retrieve from DB to confirm persistence
    const getRes = await client.get(`/debts-receivables/${debt.id}`);
    assert.strictEqual(Number(getRes.body.data.remainingBalance), 0);
    assert.strictEqual(getRes.body.data.status, 'settled');
  });

  test('T2.13: A debt past its due_date with remaining balance > 0 shows status Overdue', async () => {
    const { client } = await getOwnerClient();
    // Due date in the past
    const pastDate = '2025-01-01';
    const debt = await createDebtReceivableFixture(client, {
      principalAmount: 1000000,
      dueDate: pastDate,
    });

    const getRes = await client.get(`/debts-receivables/${debt.id}`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(
      getRes.body.data.status,
      'overdue',
      `Expected status 'overdue' for past due date, got ${getRes.body.data.status}`
    );
  });
});
