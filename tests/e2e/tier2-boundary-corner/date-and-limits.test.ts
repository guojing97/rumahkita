/**
 * Tier 2: Date Boundaries & Query Limit Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';

describe('Tier 2: Date Boundaries & Query Parameters', () => {
  test('T2.18: Yearly report preserves 12 calendar months with 0-value representation for inactive year', async () => {
    const { client } = await getOwnerClient();
    // Query a future year with guaranteed 0 transactions (e.g. 2035)
    const futureYear = 2035;

    const res = await client.get('/reports/yearly', {
      query: { year: futureYear },
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK for future year, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.monthlyTrends));
    assert.strictEqual(res.body.data.monthlyTrends.length, 12);

    for (const monthItem of res.body.data.monthlyTrends) {
      assert.strictEqual(Number(monthItem.income), 0);
      assert.strictEqual(Number(monthItem.expense), 0);
      assert.strictEqual(Number(monthItem.net), 0);
    }
  });

  test('T2.19: Invalid date query format returns 400 Bad Request', async () => {
    const { client } = await getOwnerClient();

    const res = await client.get('/incomes', {
      query: { startDate: 'invalid-date-format' },
    });

    assert.ok(
      [400, 422].includes(res.status),
      `Expected 400 or 422 for malformed date string, got ${res.status}`
    );
  });
});
