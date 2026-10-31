/**
 * Tier 1: Expenses Management Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createExpenseCategoryFixture, todayISO } from '../client/test-context.ts';

describe('Tier 1: Expenses Feature Coverage', () => {
  test('T1.15: Create expense with mandatory category and payment method', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);

    const payload = {
      date: todayISO(),
      nominal: 185000,
      categoryId: category.id,
      paymentMethod: 'transfer',
      notes: 'Tagihan Listrik PLN',
    };

    const res = await client.post('/expenses', payload);
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(Number(res.body.data.nominal), 185000);
    assert.strictEqual(res.body.data.categoryId, category.id);
  });

  test('T1.16: Query expenses with pagination and category filter', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);

    await client.post('/expenses', {
      date: todayISO(),
      nominal: 75000,
      categoryId: category.id,
      paymentMethod: 'cash',
      notes: 'Beli galon air',
    });

    const res = await client.get('/expenses', {
      query: { categoryId: category.id, page: 1, limit: 10 },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.strictEqual(res.body.data[0].categoryId, category.id);
  });

  test('T1.17: Update and soft-delete expense transaction', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);

    const createRes = await client.post('/expenses', {
      date: todayISO(),
      nominal: 50000,
      categoryId: category.id,
      paymentMethod: 'cash',
      notes: 'Snack sore',
    });
    const expenseId = createRes.body.data.id;

    // Update
    const updateRes = await client.put(`/expenses/${expenseId}`, {
      nominal: 60000,
      notes: 'Snack sore + kopi',
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(Number(updateRes.body.data.nominal), 60000);

    // Delete
    const deleteRes = await client.delete(`/expenses/${expenseId}`);
    assert.ok([200, 204].includes(deleteRes.status));
  });
});
