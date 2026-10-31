/**
 * Tier 3: Inventory Stock Threshold Transitions & Outbox Notification Events
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createItemFixture } from '../client/test-context.ts';

describe('Tier 3: Stock Threshold & Outbox Event Generation', () => {
  test('T3.5: Transition from Safe to Low stock triggers outbox notification event', async () => {
    const { client } = await getOwnerClient();
    // Item starts Safe: stock 8 > threshold 3
    const item = await createItemFixture(client, {
      quantityOnHand: 8,
      lowStockThreshold: 3,
    });

    // Reduce stock from 8 to 2 (crosses threshold 3 -> Menipis)
    const adjRes = await client.post(`/items/${item.id}/stock-adjustments`, {
      delta: -6,
      reason: 'Pemakaian dapur besar',
    });

    assert.strictEqual(adjRes.status, 200);
    assert.strictEqual(Number(adjRes.body.data.newQuantity), 2);
    assert.strictEqual(adjRes.body.data.status, 'Menipis');

    // Verify item shows up in dashboard low stock alerts
    const dashRes = await client.get('/dashboard');
    assert.strictEqual(dashRes.status, 200);
    const lowStockAlerts = dashRes.body.data.lowStockItems;
    const foundAlert = lowStockAlerts.some((i: any) => i.id === item.id);
    assert.ok(foundAlert, 'Item should appear in low stock alert list after crossing threshold');
  });

  test('T3.6: Deduplication: Further reduction on already-low item suppresses duplicate notifications', async () => {
    const { client } = await getOwnerClient();
    // Item is already in Menipis state (stock 2, threshold 3)
    const item = await createItemFixture(client, {
      quantityOnHand: 2,
      lowStockThreshold: 3,
    });

    // Reduce stock from 2 to 1 (both are <= 3, already low)
    const adjRes = await client.post(`/items/${item.id}/stock-adjustments`, {
      delta: -1,
      reason: 'Pemakaian lanjutan',
    });

    assert.strictEqual(adjRes.status, 200);
    assert.strictEqual(Number(adjRes.body.data.newQuantity), 1);
    assert.strictEqual(adjRes.body.data.status, 'Menipis');

    // Item should remain in dashboard lowStock list with updated stock 1
    const dashRes = await client.get('/dashboard');
    const alert = dashRes.body.data.lowStockItems.find((i: any) => i.id === item.id);
    assert.ok(alert);
    assert.strictEqual(Number(alert.currentStock), 1);
  });
});
