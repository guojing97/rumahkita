/**
 * Adversarial Test Suite: Purchase Completion Atomicity & Idempotency
 * Tests concurrency, idempotency replays, invalid key conflicts, and rollback atomicity.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../e2e/client/auth-helper.ts';
import {
  createExpenseCategoryFixture,
  createItemFixture,
  todayISO,
  randomString,
} from '../e2e/client/test-context.ts';

describe('Adversarial: Purchase Completion Atomicity & Idempotency', () => {
  test('ADV-P1: Complete purchase with Idempotency-Key, verify replay idempotency, and reject mismatch/missing key', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client, { quantityOnHand: 20, lowStockThreshold: 5 });
    const initialQty = 20;
    const purchaseQty = 6;
    const unitPrice = 25000;
    const idempotencyKey = `adv-key-${randomString(12)}`;

    // 1. Create Draft Purchase
    const draftRes = await client.post('/purchases', {
      date: todayISO(),
      vendor: `Vendor-${randomString(6)}`,
      expenseCategoryId: category.id,
      paymentMethod: 'transfer',
      items: [
        {
          itemId: item.id,
          itemName: item.name,
          quantity: purchaseQty,
          unitPrice,
        },
      ],
    });
    assert.strictEqual(draftRes.status, 201, `Failed to create draft: ${JSON.stringify(draftRes.body)}`);
    const purchaseId = draftRes.body.data.id;
    assert.strictEqual(draftRes.body.data.status, 'draft');
    assert.strictEqual(draftRes.body.data.totalAmount, purchaseQty * unitPrice);

    // 2. Complete with Idempotency-Key
    const completeRes1 = await client.post(
      `/purchases/${purchaseId}/complete`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(completeRes1.status, 200, `Expected 200, got ${completeRes1.status}`);
    const expenseId1 = completeRes1.body.data.expenseId;
    assert.ok(expenseId1, 'Must return linked expenseId');
    assert.strictEqual(completeRes1.body.data.status, 'completed');

    // Verify Expense Created
    const expenseRes1 = await client.get(`/expenses/${expenseId1}`);
    assert.strictEqual(expenseRes1.status, 200);
    assert.strictEqual(Number(expenseRes1.body.data.nominal), purchaseQty * unitPrice);
    assert.strictEqual(expenseRes1.body.data.purchaseId, purchaseId);

    // Verify Stock Incremented: 20 + 6 = 26
    const itemRes1 = await client.get(`/items/${item.id}`);
    assert.strictEqual(itemRes1.status, 200);
    assert.strictEqual(Number(itemRes1.body.data.quantityOnHand), initialQty + purchaseQty);

    // 3. Replay with SAME Idempotency-Key
    const completeRes2 = await client.post(
      `/purchases/${purchaseId}/complete`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(completeRes2.status, 200, 'Replay with same key must return 200 OK');
    assert.strictEqual(completeRes2.body.data.expenseId, expenseId1, 'Must return same expenseId');
    assert.strictEqual(completeRes2.body.data.status, 'completed');

    // Verify Stock was NOT incremented again: still 26
    const itemRes2 = await client.get(`/items/${item.id}`);
    assert.strictEqual(Number(itemRes2.body.data.quantityOnHand), initialQty + purchaseQty);

    // Verify no second expense was created for this purchase
    const allExpenses = await client.get(`/expenses?limit=100`);
    const linkedExpenses = allExpenses.body.data.filter((e: any) => e.purchaseId === purchaseId);
    assert.strictEqual(linkedExpenses.length, 1, 'Exactly one expense must exist for this purchase');

    // 4. Attempt completion with a DIFFERENT Idempotency-Key -> HTTP 400
    const differentKeyRes = await client.post(
      `/purchases/${purchaseId}/complete`,
      {},
      { headers: { 'Idempotency-Key': `different-${randomString(12)}` } }
    );
    assert.strictEqual(
      differentKeyRes.status,
      400,
      `Expected 400 on different idempotency key, got ${differentKeyRes.status}`
    );

    // 5. Attempt completion WITHOUT Idempotency-Key -> HTTP 400
    const noKeyRes = await client.post(`/purchases/${purchaseId}/complete`, {});
    assert.strictEqual(
      noKeyRes.status,
      400,
      `Expected 400 on missing idempotency key replay, got ${noKeyRes.status}`
    );
  });

  test('ADV-P2: Concurrent completion requests with identical Idempotency-Key execute atomically once', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client, { quantityOnHand: 50 });
    const idempotencyKey = `concurrent-same-${randomString(10)}`;

    const draftRes = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 5, unitPrice: 10000 }],
    });
    const purchaseId = draftRes.body.data.id;

    // Fire 6 simultaneous completion requests with the exact same key
    const promises = Array.from({ length: 6 }).map(() =>
      client.post(
        `/purchases/${purchaseId}/complete`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
    );

    const results = await Promise.all(promises);

    // All should return 200 OK
    for (const res of results) {
      assert.strictEqual(res.status, 200, `Concurrent response status was ${res.status}`);
      assert.strictEqual(res.body.data.status, 'completed');
    }

    // All must reference the exact same expenseId
    const firstExpenseId = results[0]!.body.data.expenseId;
    for (const res of results) {
      assert.strictEqual(res.body.data.expenseId, firstExpenseId);
    }

    // Stock should only be incremented once: 50 + 5 = 55 (NOT 50 + 30 = 80)
    const itemVerify = await client.get(`/items/${item.id}`);
    assert.strictEqual(
      Number(itemVerify.body.data.quantityOnHand),
      55,
      `Stock must be incremented exactly once. Got ${itemVerify.body.data.quantityOnHand}`
    );
  });

  test('ADV-P3: Concurrent completion race with DIFFERENT Idempotency-Keys: exactly 1 succeeds, others 400', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client, { quantityOnHand: 100 });

    const draftRes = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 10, unitPrice: 20000 }],
    });
    const purchaseId = draftRes.body.data.id;

    // 5 concurrent requests with different idempotency keys
    const promises = Array.from({ length: 5 }).map((_, i) =>
      client.post(
        `/purchases/${purchaseId}/complete`,
        {},
        { headers: { 'Idempotency-Key': `diff-race-${i}-${randomString(8)}` } }
      )
    );

    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status);

    const successCount = statuses.filter((s) => s === 200).length;
    const badRequestCount = statuses.filter((s) => s === 400).length;

    assert.strictEqual(successCount, 1, `Exactly 1 concurrent request should succeed with 200, got ${successCount}`);
    assert.strictEqual(badRequestCount, 4, `Remaining 4 requests should fail with 400, got ${badRequestCount}`);

    // Stock must be 100 + 10 = 110 (NOT 150)
    const itemVerify = await client.get(`/items/${item.id}`);
    assert.strictEqual(
      Number(itemVerify.body.data.quantityOnHand),
      110,
      `Stock increment must happen only once. Got ${itemVerify.body.data.quantityOnHand}`
    );
  });

  test('ADV-P4: Rollback Atomicity: Concurrently deleted linked item causes entire completion transaction to roll back', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const validItem = await createItemFixture(client, { quantityOnHand: 30 });
    const itemToBeDeleted = await createItemFixture(client, { quantityOnHand: 15 });

    // 1. Create draft purchase with 2 valid items
    const draftRes = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [
        { itemId: validItem.id, itemName: validItem.name, quantity: 5, unitPrice: 10000 },
        { itemId: itemToBeDeleted.id, itemName: itemToBeDeleted.name, quantity: 2, unitPrice: 15000 },
      ],
    });
    assert.strictEqual(draftRes.status, 201);
    const purchaseId = draftRes.body.data.id;

    // 2. Soft-delete the second item prior to purchase completion
    const deleteRes = await client.delete(`/items/${itemToBeDeleted.id}`);
    assert.strictEqual(deleteRes.status, 200);

    // 3. Attempt to complete purchase
    const completeRes = await client.post(
      `/purchases/${purchaseId}/complete`,
      {},
      { headers: { 'Idempotency-Key': `rollback-${randomString(10)}` } }
    );

    // Must fail with 404 (item not found)
    assert.strictEqual(completeRes.status, 404, `Expected 404 for deleted item, got ${completeRes.status}`);

    // 4. Verify Purchase remains in 'draft' status
    const purchaseVerify = await client.get(`/purchases/${purchaseId}`);
    assert.strictEqual(purchaseVerify.body.data.status, 'draft', 'Purchase status must remain draft after rollback');

    // 5. Verify Valid Item stock was NOT incremented: remains 30
    const validItemVerify = await client.get(`/items/${validItem.id}`);
    assert.strictEqual(
      Number(validItemVerify.body.data.quantityOnHand),
      30,
      'Valid item stock must not be incremented when transaction rolls back'
    );

    // 6. Verify NO expense was created for this purchase
    const expensesRes = await client.get('/expenses?limit=100');
    const linkedExpense = expensesRes.body.data.find((e: any) => e.purchaseId === purchaseId);
    assert.strictEqual(linkedExpense, undefined, 'No expense should be created after rollback');
  });

  test('ADV-P5: Completed purchase cannot be cancelled; cancelled purchase cannot be completed', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client, { quantityOnHand: 15 });

    // 1. Create and complete purchase
    const draft1 = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 2, unitPrice: 5000 }],
    });
    const purchase1Id = draft1.body.data.id;
    await client.post(`/purchases/${purchase1Id}/complete`);

    // Attempt cancel on completed purchase -> 400
    const cancelRes = await client.post(`/purchases/${purchase1Id}/cancel`, {
      reason: 'Salah pencatatan pembelian',
    });
    assert.strictEqual(
      cancelRes.status,
      400,
      `Expected 400 when cancelling completed purchase, got ${cancelRes.status}`
    );

    // 2. Create and cancel purchase
    const draft2 = await client.post('/purchases', {
      date: todayISO(),
      expenseCategoryId: category.id,
      items: [{ itemId: item.id, itemName: item.name, quantity: 2, unitPrice: 5000 }],
    });
    const purchase2Id = draft2.body.data.id;
    const cancelOk = await client.post(`/purchases/${purchase2Id}/cancel`, {
      reason: 'Batal beli karena toko tutup',
    });
    assert.strictEqual(cancelOk.status, 200);

    // Attempt complete on cancelled purchase -> 400
    const completeCancelled = await client.post(`/purchases/${purchase2Id}/complete`);
    assert.strictEqual(
      completeCancelled.status,
      400,
      `Expected 400 when completing cancelled purchase, got ${completeCancelled.status}`
    );
  });
});
