/**
 * Adversarial Test Suite: Multi-Tenant Cross-Household Isolation
 * Probes tenant data isolation across transactions, purchases, stock adjustments, and debt payments.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient, getOtherHouseholdClient } from '../e2e/client/auth-helper.ts';
import {
  createItemFixture,
  createExpenseCategoryFixture,
  createDebtReceivableFixture,
  todayISO,
  randomString,
} from '../e2e/client/test-context.ts';

describe('Adversarial: Multi-Tenant Cross-Household Isolation', () => {
  test('ADV-M1: Household B cannot complete Household A purchase draft', async () => {
    const { client: ownerClient } = await getOwnerClient();
    const { client: otherClient } = await getOtherHouseholdClient();

    const category = await createExpenseCategoryFixture(ownerClient);
    const item = await createItemFixture(ownerClient, { quantityOnHand: 20 });

    const draftRes = await ownerClient.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 5, unitPrice: 10000 }],
    });
    const purchaseId = draftRes.body.data.id;

    // Household B attempts to complete Household A's purchase
    const completeRes = await otherClient.post(`/purchases/${purchaseId}/complete`, {
      headers: { 'Idempotency-Key': `cross-attack-${randomString(8)}` },
    });

    assert.strictEqual(
      [403, 404].includes(completeRes.status),
      true,
      `Expected 403 or 404 for cross-household complete, got ${completeRes.status}`
    );

    // Verify Household A's purchase is still in draft status
    const purchaseVerify = await ownerClient.get(`/purchases/${purchaseId}`);
    assert.strictEqual(purchaseVerify.body.data.status, 'draft');

    // Verify Household A's item stock was NOT incremented
    const itemVerify = await ownerClient.get(`/items/${item.id}`);
    assert.strictEqual(Number(itemVerify.body.data.quantityOnHand), 20);
  });

  test('ADV-M2: Household B cannot adjust Household A item stock', async () => {
    const { client: ownerClient } = await getOwnerClient();
    const { client: otherClient } = await getOtherHouseholdClient();

    const item = await createItemFixture(ownerClient, { quantityOnHand: 15 });

    // Household B attempts to adjust Household A's stock
    const adjustRes = await otherClient.post(`/items/${item.id}/stock-adjustments`, {
      delta: -10,
      reason: 'Penyusupan stok cross-tenant',
    });

    assert.strictEqual(
      [403, 404].includes(adjustRes.status),
      true,
      `Expected 403 or 404 for cross-household stock adjustment, got ${adjustRes.status}`
    );

    // Verify Household A's stock is untouched
    const itemVerify = await ownerClient.get(`/items/${item.id}`);
    assert.strictEqual(Number(itemVerify.body.data.quantityOnHand), 15);
  });

  test('ADV-M3: Household B cannot record payment on Household A debt', async () => {
    const { client: ownerClient } = await getOwnerClient();
    const { client: otherClient } = await getOtherHouseholdClient();

    const debt = await createDebtReceivableFixture(ownerClient, {
      principalAmount: 500000,
    });

    // Household B attempts to record payment on Household A's debt
    const payRes = await otherClient.post(`/debts-receivables/${debt.id}/payments`, {
      amount: 100000,
      paymentDate: todayISO(),
      paymentMethod: 'cash',
    });

    assert.strictEqual(
      [403, 404].includes(payRes.status),
      true,
      `Expected 403 or 404 for cross-household debt payment, got ${payRes.status}`
    );

    // Verify Household A's remaining balance is unchanged
    const debtVerify = await ownerClient.get(`/debts-receivables/${debt.id}`);
    assert.strictEqual(Number(debtVerify.body.data.remainingBalance), 500000);
  });
});
