/**
 * Tier 1: Incomes Management Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { createIncomeSourceFixture, todayISO } from '../client/test-context.ts';

describe('Tier 1: Incomes Feature Coverage', () => {
  test('T1.11: Create income with valid positive nominal and sourceId', async () => {
    const { client } = await getOwnerClient();
    const source = await createIncomeSourceFixture(client);

    const payload = {
      date: todayISO(),
      nominal: 12500000,
      sourceId: source.id,
      notes: 'Gaji Bulanan Oktober',
    };

    const res = await client.post('/incomes', payload);
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(Number(res.body.data.nominal), 12500000);
    assert.strictEqual(res.body.data.sourceId, source.id);
  });

  test('T1.12: Query incomes with pagination meta (page, limit, total)', async () => {
    const { client } = await getOwnerClient();
    const res = await client.get('/incomes', {
      query: { page: 1, limit: 10 },
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data), 'Data should be an array');
    assert.ok(res.body.meta, 'Pagination meta must be returned');
    assert.strictEqual(Number(res.body.meta.page), 1);
    assert.strictEqual(Number(res.body.meta.limit), 10);
    assert.ok(typeof res.body.meta.total === 'number');
  });

  test('T1.13: Filter incomes by date range', async () => {
    const { client } = await getOwnerClient();
    const source = await createIncomeSourceFixture(client);

    await client.post('/incomes', {
      date: '2026-10-15',
      nominal: 2000000,
      sourceId: source.id,
      notes: 'Mid-month freelance',
    });

    const res = await client.get('/incomes', {
      query: {
        startDate: '2026-10-10',
        endDate: '2026-10-20',
      },
    });

    assert.strictEqual(res.status, 200);
    const inRange = res.body.data.every((inc: any) => {
      const d = inc.date.split('T')[0];
      return d >= '2026-10-10' && d <= '2026-10-20';
    });
    assert.ok(inRange, 'All returned incomes should fall within requested date range');
  });

  test('T1.14: Update and soft-delete income record', async () => {
    const { client } = await getOwnerClient();
    const source = await createIncomeSourceFixture(client);

    const createRes = await client.post('/incomes', {
      date: todayISO(),
      nominal: 5000000,
      sourceId: source.id,
      notes: 'Initial amount',
    });
    const incomeId = createRes.body.data.id;

    // Update
    const updateRes = await client.put(`/incomes/${incomeId}`, {
      nominal: 5500000,
      notes: 'Updated with bonus',
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(Number(updateRes.body.data.nominal), 5500000);

    // Delete
    const deleteRes = await client.delete(`/incomes/${incomeId}`);
    assert.ok([200, 204].includes(deleteRes.status));
  });
});
