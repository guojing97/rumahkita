/**
 * Tier 1: Purchases Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createExpenseCategoryFixture, createItemFixture, todayISO } from '../client/test-context.ts';

describe('Tier 1: Purchases Feature Coverage', () => {
  test('T1.21: Create purchase draft calculates items subtotal on server', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client);

    const payload = {
      date: todayISO(),
      vendor: 'Superindo Express',
      expenseCategoryId: category.id,
      paymentMethod: 'cash',
      notes: 'Belanja mingguan',
      items: [
        {
          itemId: item.id,
          itemName: item.name,
          quantity: 3,
          unitPrice: 25000,
        },
        {
          itemId: null,
          itemName: 'Kantong Plastik / Non-inventory',
          quantity: 2,
          unitPrice: 5000,
        },
      ],
    };

    const res = await client.post('/purchases', payload);
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'draft');

    // Expected total: 3 * 25000 + 2 * 5000 = 75000 + 10000 = 85000
    assert.strictEqual(Number(res.body.data.totalAmount), 85000);
  });

  test('T1.22: Cancel purchase draft transitions status to cancelled', async () => {
    const { client } = await getOwnerClient();
    const category = await createExpenseCategoryFixture(client);
    const item = await createItemFixture(client);

    const createRes = await client.post('/purchases', {
      date: todayISO(),
      vendor: 'Toko Kelontong',
      expenseCategoryId: category.id,
      items: [
        {
          itemId: item.id,
          itemName: item.name,
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    });
    const purchaseId = createRes.body.data.id;

    // Cancel
    const cancelRes = await client.post(`/purchases/${purchaseId}/cancel`, {
      reason: 'Rencana belanja dibatalkan',
    });
    assert.strictEqual(cancelRes.status, 200);

    // Verify status
    const getRes = await client.get(`/purchases/${purchaseId}`);
    assert.strictEqual(getRes.body.data.status, 'cancelled');
  });
});
