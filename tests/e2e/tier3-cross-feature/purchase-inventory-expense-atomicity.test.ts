/**
 * Tier 3: Cross-Feature Atomicity Tests
 * Verifies that Purchase Completion creates an expense and increments item stock atomically.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createExpenseCategoryFixture, createItemFixture, todayISO, randomString } from '../client/test-context.ts';

describe('Tier 3: Purchase -> Stock -> Expense Atomicity', () => {
  test('T3.1: POST /purchases/:id/complete creates exactly one expense and increments stock atomically', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    // Initial item stock: 5 units
    const item = await createItemFixture(client, { quantityOnHand: 5, lowStockThreshold: 2 });

    // Create purchase draft with 4 units of item at Rp 30,000 each
    const purchaseRes = await client.post('/purchases', {
      date: todayISO(),
      vendor: 'Supermarket Bahagia',
      expenseCategoryId: category.id,
      paymentMethod: 'transfer',
      notes: 'Restock beras dan sembako',
      items: [
        {
          itemId: item.id,
          itemName: item.name,
          quantity: 4,
          unitPrice: 30000,
        },
      ],
    });
    const purchaseId = purchaseRes.body.data.id;
    assert.strictEqual(purchaseRes.body.data.status, 'draft');
    const expectedExpenseNominal = 4 * 30000; // 120,000

    // Complete purchase
    const completeRes = await client.post(`/purchases/${purchaseId}/complete`, {}, {
      headers: {
        'Idempotency-Key': `e2e-idemp-${randomString(10)}`,
      },
    });

    assert.strictEqual(completeRes.status, 200, `Expected 200 OK, got ${completeRes.status}`);
    assert.strictEqual(completeRes.body.data.status, 'completed');
    assert.ok(completeRes.body.data.expenseId, 'Linked expenseId must be returned');

    // 1. Verify Expense creation
    const expenseRes = await client.get(`/expenses/${completeRes.body.data.expenseId}`);
    assert.strictEqual(expenseRes.status, 200);
    assert.strictEqual(Number(expenseRes.body.data.nominal), expectedExpenseNominal);
    assert.strictEqual(expenseRes.body.data.categoryId, category.id);
    assert.strictEqual(expenseRes.body.data.purchaseId, purchaseId);

    // 2. Verify Item stock increment: 5 + 4 = 9 units
    const itemVerifyRes = await client.get(`/items/${item.id}`);
    assert.strictEqual(itemVerifyRes.status, 200);
    assert.strictEqual(
      Number(itemVerifyRes.body.data.quantityOnHand),
      9,
      'Item stock must be incremented by purchased quantity'
    );

    // 3. Verify Stock Movement entry was logged
    const movementsRes = await client.get(`/items/${item.id}/stock-adjustments`);
    assert.strictEqual(movementsRes.status, 200);
    const purchaseMovement = movementsRes.body.data.find(
      (m: any) => m.referenceId === purchaseId || m.reason === 'purchase'
    );
    assert.ok(purchaseMovement, 'Stock movement entry for purchase must exist');
    assert.strictEqual(Number(purchaseMovement.quantityDelta), 4);
  });

  test('T3.2: Replaying purchase completion with same idempotency key is idempotent', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client, { quantityOnHand: 10 });
    const idempotencyKey = `idemp-${randomString(12)}`;

    const draft = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 2, unitPrice: 15000 }],
    });
    const purchaseId = draft.body.data.id;

    // First completion
    const res1 = await client.post(`/purchases/${purchaseId}/complete`, {}, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    assert.strictEqual(res1.status, 200);

    // Second completion with identical key
    const res2 = await client.post(`/purchases/${purchaseId}/complete`, {}, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    assert.strictEqual(res2.status, 200);

    // Verify stock incremented ONLY ONCE: 10 + 2 = 12 (not 14)
    const itemVerify = await client.get(`/items/${item.id}`);
    assert.strictEqual(Number(itemVerify.body.data.quantityOnHand), 12);
  });

  test('T3.3: Attempting to complete an already completed purchase without idempotency key returns 400', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client, { quantityOnHand: 5 });

    const draft = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: 10000 }],
    });
    const purchaseId = draft.body.data.id;

    await client.post(`/purchases/${purchaseId}/complete`);

    // Second attempt without identical idempotency header
    const secondComplete = await client.post(`/purchases/${purchaseId}/complete`);
    assert.strictEqual(
      secondComplete.status,
      400,
      `Expected 400 when completing already-completed purchase, got ${secondComplete.status}`
    );
  });
});
