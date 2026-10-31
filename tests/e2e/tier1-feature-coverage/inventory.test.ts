/**
 * Tier 1: Inventory Management & Stock Adjustments Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { randomString } from '../client/test-context.ts';

describe('Tier 1: Inventory & Stock Adjustments', () => {
  test('T1.18: Create inventory item with initial stock and threshold', async () => {
    const { client } = await getOwnerClient();
    const itemName = `Beras Rojolele ${randomString()}`;

    const res = await client.post('/items', {
      name: itemName,
      category: 'Sembako',
      unit: 'kg',
      quantityOnHand: 15,
      lowStockThreshold: 5,
      location: 'Dapur',
      notes: 'Beras pulen',
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, itemName);
    assert.strictEqual(Number(res.body.data.quantityOnHand), 15);
    assert.strictEqual(Number(res.body.data.lowStockThreshold), 5);
  });

  test('T1.19: Item status correctly evaluates to Aman, Menipis, and Habis', async () => {
    const { client } = await getOwnerClient();

    // 1. Item with stock > threshold => Aman
    const itemAman = await client.post('/items', {
      name: `Kecap Manis ${randomString()}`,
      unit: 'botol',
      quantityOnHand: 10,
      lowStockThreshold: 3,
    });
    assert.strictEqual(itemAman.body.data.status, 'Aman');

    // 2. Item with 0 < stock <= threshold => Menipis
    const itemMenipis = await client.post('/items', {
      name: `Garam Dapur ${randomString()}`,
      unit: 'bungkus',
      quantityOnHand: 2,
      lowStockThreshold: 3,
    });
    assert.strictEqual(itemMenipis.body.data.status, 'Menipis');

    // 3. Item with stock = 0 => Habis
    const itemHabis = await client.post('/items', {
      name: `Tepung Terigu ${randomString()}`,
      unit: 'kg',
      quantityOnHand: 0,
      lowStockThreshold: 2,
    });
    assert.strictEqual(itemHabis.body.data.status, 'Habis');
  });

  test('T1.20: Manual stock adjustment updates quantity and logs movement', async () => {
    const { client } = await getOwnerClient();

    // Create item with 10 units
    const itemRes = await client.post('/items', {
      name: `Minyak Kelapa ${randomString()}`,
      unit: 'liter',
      quantityOnHand: 10,
      lowStockThreshold: 3,
    });
    const itemId = itemRes.body.data.id;

    // Apply adjustment delta -2
    const adjRes = await client.post(`/items/${itemId}/stock-adjustments`, {
      delta: -2,
      reason: 'Digunakan untuk memasak katering keluarga',
    });

    assert.strictEqual(adjRes.status, 200, `Expected 200 OK, got ${adjRes.status}`);
    assert.strictEqual(Number(adjRes.body.data.newQuantity), 8);

    // Verify stock adjustment history
    const historyRes = await client.get(`/items/${itemId}/stock-adjustments`);
    assert.strictEqual(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.body.data));
    assert.ok(historyRes.body.data.length >= 1);
    assert.strictEqual(Number(historyRes.body.data[0].quantityDelta), -2);
  });
});
