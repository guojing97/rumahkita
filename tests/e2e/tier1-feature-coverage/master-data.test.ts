/**
 * Tier 1: Master Data Management & Household Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import { randomString } from '../client/test-context.ts';

describe('Tier 1: Master Data & Household', () => {
  test('T1.7: Retrieve current household profile and member list', async () => {
    const { client } = await getOwnerClient();
    const res = await client.get('/household');

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id, 'Household ID must exist');
    assert.ok(Array.isArray(res.body.data.members), 'Members must be an array');
    assert.ok(res.body.data.members.length >= 1, 'Should have at least 1 member');
  });

  test('T1.8: Income Sources CRUD operations', async () => {
    const { client } = await getOwnerClient();
    const sourceName = `Usaha Online ${randomString()}`;

    // 1. Create
    const createRes = await client.post('/income-sources', {
      name: sourceName,
      description: 'Hasil jualan online',
    });
    assert.strictEqual(createRes.status, 201, `Create income source failed: ${createRes.status}`);
    const sourceId = createRes.body.data.id;
    assert.ok(sourceId, 'Income source ID returned');

    // 2. List
    const listRes = await client.get('/income-sources');
    assert.strictEqual(listRes.status, 200);
    const found = listRes.body.data.some((s: any) => s.id === sourceId);
    assert.ok(found, 'Created income source must appear in list');

    // 3. Update
    const updateRes = await client.put(`/income-sources/${sourceId}`, {
      name: `${sourceName} Updated`,
      description: 'Updated desc',
      isActive: true,
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.name, `${sourceName} Updated`);

    // 4. Delete (Soft archive)
    const deleteRes = await client.delete(`/income-sources/${sourceId}`);
    assert.ok([200, 204].includes(deleteRes.status), `Delete status expected 200/204, got ${deleteRes.status}`);
  });

  test('T1.9: Expense Categories CRUD operations', async () => {
    const { client } = await getOwnerClient();
    const catName = `Kebutuhan Dapur ${randomString()}`;

    // 1. Create
    const createRes = await client.post('/expense-categories', {
      name: catName,
      icon: 'utensils',
      color: '#E11D48',
      budgetLimit: 3000000,
    });
    assert.strictEqual(createRes.status, 201, `Create category failed: ${createRes.status}`);
    const catId = createRes.body.data.id;
    assert.ok(catId);

    // 2. List
    const listRes = await client.get('/expense-categories');
    assert.strictEqual(listRes.status, 200);
    const found = listRes.body.data.some((c: any) => c.id === catId);
    assert.ok(found, 'Created category must appear in categories list');

    // 3. Update
    const updateRes = await client.put(`/expense-categories/${catId}`, {
      name: `${catName} Rev`,
      budgetLimit: 3500000,
    });
    assert.strictEqual(updateRes.status, 200);

    // 4. Delete
    const deleteRes = await client.delete(`/expense-categories/${catId}`);
    assert.ok([200, 204].includes(deleteRes.status));
  });

  test('T1.10: Income Categories CRUD operations', async () => {
    const { client } = await getOwnerClient();
    const catName = `Dividen Saham ${randomString()}`;

    // 1. Create
    const createRes = await client.post('/income-categories', {
      name: catName,
      icon: 'trending-up',
      color: '#10B981',
    });
    assert.strictEqual(createRes.status, 201);
    const catId = createRes.body.data.id;

    // 2. List
    const listRes = await client.get('/income-categories');
    assert.strictEqual(listRes.status, 200);
    const found = listRes.body.data.some((c: any) => c.id === catId);
    assert.ok(found);

    // 3. Delete
    const deleteRes = await client.delete(`/income-categories/${catId}`);
    assert.ok([200, 204].includes(deleteRes.status));
  });
});
