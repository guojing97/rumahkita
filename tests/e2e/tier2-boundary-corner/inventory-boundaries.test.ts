/**
 * Tier 2: Inventory Boundaries & Stock Invariant Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createItemFixture } from '../client/test-context.ts';

describe('Tier 2: Inventory Boundary & Corner Cases', () => {
  test('T2.6: Stock adjustment without a reason returns 422 Unprocessable Entity', async () => {
    const { client } = await getOwnerClient();
    const item = await createItemFixture(client, { quantityOnHand: 5 });

    const res = await client.post(`/items/${item.id}/stock-adjustments`, {
      delta: -1,
      // reason intentionally omitted
    });

    assert.strictEqual(res.status, 422, `Expected 422 for missing adjustment reason, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
  });

  test('T2.7: Stock cannot go below zero — adjustment resulting in negative stock returns 422', async () => {
    const { client } = await getOwnerClient();
    // Item has stock of 2
    const item = await createItemFixture(client, { quantityOnHand: 2 });

    // Attempt to reduce stock by 5
    const res = await client.post(`/items/${item.id}/stock-adjustments`, {
      delta: -5,
      reason: 'Pengurangan melebihi stok yang ada',
    });

    assert.strictEqual(
      res.status,
      422,
      `Expected 422 when adjustment delta results in negative stock, got ${res.status}`
    );
    assert.strictEqual(res.body.success, false);

    // Verify stock remains untouched at 2
    const verifyRes = await client.get(`/items/${item.id}`);
    assert.strictEqual(Number(verifyRes.body.data.quantityOnHand), 2);
  });

  test('T2.8: Stock adjustment reducing quantity to exactly 0 succeeds and marks status Habis', async () => {
    const { client } = await getOwnerClient();
    const item = await createItemFixture(client, { quantityOnHand: 4, lowStockThreshold: 2 });

    const res = await client.post(`/items/${item.id}/stock-adjustments`, {
      delta: -4,
      reason: 'Habis terpakai seluruhnya',
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK for exact 0, got ${res.status}`);
    assert.strictEqual(Number(res.body.data.newQuantity), 0);
    assert.strictEqual(res.body.data.status, 'Habis');
  });

  test('T2.9: Stock exactly equal to low_stock_threshold transitions status to Menipis', async () => {
    const { client } = await getOwnerClient();
    const item = await createItemFixture(client, { quantityOnHand: 6, lowStockThreshold: 3 });

    // Reduce by 3 so resulting stock is exactly 3 (threshold = 3)
    const res = await client.post(`/items/${item.id}/stock-adjustments`, {
      delta: -3,
      reason: 'Pemakaian reguler hingga batas threshold',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(Number(res.body.data.newQuantity), 3);
    assert.strictEqual(res.body.data.status, 'Menipis');
  });
});
