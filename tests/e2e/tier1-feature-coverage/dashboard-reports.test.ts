/**
 * Tier 1: Dashboard Aggregations & Reports Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';

describe('Tier 1: Dashboard & Reports Feature Coverage', () => {
  test('T1.25: Dashboard endpoint returns summary metrics, recent transactions, and low stock items', async () => {
    const { client } = await getOwnerClient();
    const res = await client.get('/dashboard', {
      query: { period: 'this_month' },
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);

    const data = res.body.data;
    assert.ok(data.summaryCards, 'Summary cards object must exist');
    assert.ok('totalIncome' in data.summaryCards, 'totalIncome metric must exist');
    assert.ok('totalExpense' in data.summaryCards, 'totalExpense metric must exist');
    assert.ok('netCashFlow' in data.summaryCards, 'netCashFlow metric must exist');

    assert.ok(Array.isArray(data.recentTransactions), 'recentTransactions must be an array');
    assert.ok(Array.isArray(data.lowStockItems), 'lowStockItems must be an array');
  });

  test('T1.26: Monthly report endpoint returns category breakdowns and cash flow', async () => {
    const { client } = await getOwnerClient();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const res = await client.get('/reports/monthly', {
      query: { year: currentYear, month: currentMonth },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok('totalIncome' in res.body.data);
    assert.ok('totalExpense' in res.body.data);
    assert.ok('netCashFlow' in res.body.data);
  });

  test('T1.27: Yearly report endpoint returns exactly 12 months with zero continuity', async () => {
    const { client } = await getOwnerClient();
    const currentYear = new Date().getFullYear();

    const res = await client.get('/reports/yearly', {
      query: { year: currentYear },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.monthlyTrends), 'monthlyTrends must be an array');
    assert.strictEqual(res.body.data.monthlyTrends.length, 12, 'Yearly report must return exactly 12 months');
  });

  test('T1.28: CSV export endpoint returns RFC 4180 CSV text stream with proper headers', async () => {
    const { client } = await getOwnerClient();
    const res = await client.get('/reports/export/csv', {
      query: { type: 'transactions' },
    });

    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(
      contentType.includes('text/csv'),
      `Expected Content-Type to include text/csv, got: ${contentType}`
    );

    const disposition = res.headers.get('content-disposition') || '';
    assert.ok(
      disposition.includes('attachment'),
      `Expected Content-Disposition to include attachment, got: ${disposition}`
    );

    assert.ok(typeof res.rawText === 'string');
    assert.ok(res.rawText.length > 0, 'CSV stream should not be empty');
  });
});
