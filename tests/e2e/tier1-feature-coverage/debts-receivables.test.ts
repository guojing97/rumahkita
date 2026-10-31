/**
 * Tier 1: Debts & Receivables Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { randomString, todayISO } from '../client/test-context.ts';

describe('Tier 1: Debts & Receivables Feature Coverage', () => {
  test('T1.23: Create debt payable and receivable records with remaining balance equal to principal', async () => {
    const { client } = await getOwnerClient();

    // 1. Payable
    const payableRes = await client.post('/debts-receivables', {
      type: 'payable',
      partyName: `Pak Budi RT ${randomString()}`,
      description: 'Pinjaman Kas RT',
      principalAmount: 2000000,
      dueDate: '2026-12-31',
    });
    assert.strictEqual(payableRes.status, 201);
    assert.strictEqual(payableRes.body.data.type, 'payable');
    assert.strictEqual(Number(payableRes.body.data.principalAmount), 2000000);
    assert.strictEqual(Number(payableRes.body.data.remainingBalance), 2000000);
    assert.strictEqual(payableRes.body.data.status, 'open');

    // 2. Receivable
    const receivableRes = await client.post('/debts-receivables', {
      type: 'receivable',
      partyName: `Teman Kantor ${randomString()}`,
      description: 'Talangan Tiket Kereta',
      principalAmount: 500000,
      dueDate: '2026-11-15',
    });
    assert.strictEqual(receivableRes.status, 201);
    assert.strictEqual(receivableRes.body.data.type, 'receivable');
    assert.strictEqual(Number(receivableRes.body.data.remainingBalance), 500000);
  });

  test('T1.24: Record partial payment decrements remaining balance', async () => {
    const { client } = await getOwnerClient();

    // Create 1,000,000 debt
    const createRes = await client.post('/debts-receivables', {
      type: 'payable',
      partyName: `Koperasi Warga ${randomString()}`,
      principalAmount: 1000000,
      dueDate: '2026-12-31',
    });
    const debtId = createRes.body.data.id;

    // Record 300,000 payment
    const payRes = await client.post(`/debts-receivables/${debtId}/payments`, {
      paymentDate: todayISO(),
      amount: 300000,
      paymentMethod: 'transfer',
      notes: 'Cicilan pertama',
    });

    assert.strictEqual(payRes.status, 200, `Expected 200 OK, got ${payRes.status}`);
    assert.strictEqual(Number(payRes.body.data.remainingBalance), 700000);
    assert.strictEqual(payRes.body.data.status, 'partially_paid');

    // Retrieve debt detail
    const getRes = await client.get(`/debts-receivables/${debtId}`);
    assert.strictEqual(Number(getRes.body.data.remainingBalance), 700000);
  });
});
