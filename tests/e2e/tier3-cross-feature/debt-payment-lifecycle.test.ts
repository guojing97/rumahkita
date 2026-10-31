/**
 * Tier 3: Debt & Receivable Multi-Stage Payment Lifecycle Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { randomString, todayISO } from '../client/test-context.ts';

describe('Tier 3: Debt Payment Lifecycle', () => {
  test('T3.4: Complete Debt Lifecycle: Open -> PartiallyPaid -> Settled', async () => {
    const { client } = await getOwnerClient();

    // 1. Initial Creation: 1,000,000
    const createRes = await client.post('/debts-receivables', {
      type: 'payable',
      partyName: `Keluarga Besar ${randomString()}`,
      description: 'Pinjaman Renovasi Atap',
      principalAmount: 1000000,
      dueDate: '2026-12-31',
    });
    const debtId = createRes.body.data.id;
    assert.strictEqual(createRes.body.data.status, 'open');
    assert.strictEqual(Number(createRes.body.data.remainingBalance), 1000000);

    // 2. Stage 1 Payment: 300,000 -> remaining: 700,000
    const pay1 = await client.post(`/debts-receivables/${debtId}/payments`, {
      paymentDate: todayISO(),
      amount: 300000,
      paymentMethod: 'transfer',
      notes: 'Pembayaran tahap 1',
    });
    assert.strictEqual(pay1.status, 200);
    assert.strictEqual(Number(pay1.body.data.remainingBalance), 700000);
    assert.strictEqual(pay1.body.data.status, 'partially_paid');

    // 3. Stage 2 Payment: 700,000 -> remaining: 0, status: settled
    const pay2 = await client.post(`/debts-receivables/${debtId}/payments`, {
      paymentDate: todayISO(),
      amount: 700000,
      paymentMethod: 'transfer',
      notes: 'Pelunasan sisa',
    });
    assert.strictEqual(pay2.status, 200);
    assert.strictEqual(Number(pay2.body.data.remainingBalance), 0);
    assert.strictEqual(pay2.body.data.status, 'settled');

    // 4. Verify Final State
    const finalDebt = await client.get(`/debts-receivables/${debtId}`);
    assert.strictEqual(Number(finalDebt.body.data.remainingBalance), 0);
    assert.strictEqual(finalDebt.body.data.status, 'settled');
  });
});
