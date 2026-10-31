/**
 * Tier 2: Financial Boundaries & Input Validation Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createIncomeSourceFixture, createExpenseCategoryFixture, todayISO } from '../client/test-context.ts';

describe('Tier 2: Financial Boundary & Corner Cases', () => {
  test('T2.1: Creating an income with nominal = 0 returns 422 Unprocessable Entity', async () => {
    const { client } = await getOwnerClient();
    const source = await createIncomeSourceFixture(client);

    const res = await client.post('/incomes', {
      date: todayISO(),
      nominal: 0,
      sourceId: source.id,
      notes: 'Zero nominal test',
    });

    assert.strictEqual(res.status, 422, `Expected 422 for nominal 0, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  test('T2.2: Creating an income with negative nominal returns 422 Unprocessable Entity', async () => {
    const { client } = await getOwnerClient();
    const source = await createIncomeSourceFixture(client);

    const res = await client.post('/incomes', {
      date: todayISO(),
      nominal: -50000,
      sourceId: source.id,
      notes: 'Negative nominal test',
    });

    assert.strictEqual(res.status, 422, `Expected 422 for negative nominal, got ${res.status}`);
  });

  test('T2.3: Creating an expense with nominal <= 0 returns 422 Unprocessable Entity', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);

    const resZero = await client.post('/expenses', {
      date: todayISO(),
      nominal: 0,
      categoryId: category.id,
    });
    assert.strictEqual(resZero.status, 422, `Expected 422 for expense nominal 0, got ${resZero.status}`);

    const resNegative = await client.post('/expenses', {
      date: todayISO(),
      nominal: -100000,
      categoryId: category.id,
    });
    assert.strictEqual(resNegative.status, 422, `Expected 422 for expense nominal < 0, got ${resNegative.status}`);
  });

  test('T2.4: Creating an expense without a category returns 422 Unprocessable Entity', async () => {
    const { client } = await getOwnerClient();

    const res = await client.post('/expenses', {
      date: todayISO(),
      nominal: 50000,
      // categoryId intentionally omitted
      paymentMethod: 'cash',
      notes: 'Expense without category',
    });

    assert.strictEqual(res.status, 422, `Expected 422 when categoryId is missing, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  test('T2.5: Maximum IDR nominal boundary (999,999,999,999) handled without numeric overflow', async () => {
    const { client } = await getOwnerClient();
    const source = await createIncomeSourceFixture(client);
    const maxIDR = 999_999_999_999;

    const res = await client.post('/incomes', {
      date: todayISO(),
      nominal: maxIDR,
      sourceId: source.id,
      notes: 'Max Rupiah boundary test',
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created for max boundary, got ${res.status}`);
    assert.strictEqual(Number(res.body.data.nominal), maxIDR);

    // Clean up
    await client.delete(`/incomes/${res.body.data.id}`);
  });
});
