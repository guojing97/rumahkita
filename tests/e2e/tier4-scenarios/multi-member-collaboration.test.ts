/**
 * Tier 4: Real-World Scenario — Multi-Member Household Collaboration
 *
 * Verifies that the two household members (Owner and Member) can log in,
 * access the same household's financial and inventory records, and collaborate seamlessly.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient, getMemberClient } from '../client/auth-helper.ts';
import { createExpenseCategoryFixture, todayISO, randomString } from '../client/test-context.ts';

describe('Tier 4: Multi-Member Household Collaboration', () => {
  test('T4.2: Both household members collaborate on shared budget and inventory in real time', async () => {
    // 1. Both members authenticate
    const { client: clientOwner, auth: authOwner } = await getOwnerClient();
    const { client: clientMember, auth: authMember } = await getMemberClient();

    // Verify both belong to the exact same household
    assert.strictEqual(
      authOwner.household.id,
      authMember.household.id,
      'Both seeded users must belong to the identical household'
    );
    const sharedHouseholdId = authOwner.household.id;

    // Verify members list on household endpoint shows both users
    const houseRes = await clientMember.get('/household');
    assert.strictEqual(houseRes.status, 200);
    assert.strictEqual(houseRes.body.data.id, sharedHouseholdId);
    const emails = houseRes.body.data.members.map((m: any) => m.email);
    assert.ok(emails.includes(authOwner.user.email));
    assert.ok(emails.includes(authMember.user.email));

    // -------------------------------------------------------------------------
    // 2. Owner logs a shared expense category & expense
    // -------------------------------------------------------------------------
    const category = await createExpenseCategoryFixture(clientOwner, `Dapur Bersama ${randomString()}`);
    const expenseRes = await clientOwner.post('/expenses', {
      date: todayISO(),
      nominal: 120000,
      categoryId: category.id,
      paymentMethod: 'cash',
      notes: 'Beli buah untuk sarapan bersama',
    });
    assert.strictEqual(expenseRes.status, 201);
    const expenseId = expenseRes.body.data.id;

    // -------------------------------------------------------------------------
    // 3. Member reads the expense recorded by Owner
    // -------------------------------------------------------------------------
    const memberReadExpense = await clientMember.get(`/expenses/${expenseId}`);
    assert.strictEqual(memberReadExpense.status, 200);
    assert.strictEqual(Number(memberReadExpense.body.data.nominal), 120000);
    assert.strictEqual(memberReadExpense.body.data.notes, 'Beli buah untuk sarapan bersama');

    // -------------------------------------------------------------------------
    // 4. Member adds an inventory item and logs a stock adjustment
    // -------------------------------------------------------------------------
    const itemName = `Kopi Tubruk ${randomString()}`;
    const itemRes = await clientMember.post('/items', {
      name: itemName,
      unit: 'pack',
      quantityOnHand: 5,
      lowStockThreshold: 2,
    });
    assert.strictEqual(itemRes.status, 201);
    const itemId = itemRes.body.data.id;

    // Member uses 1 pack
    const adjRes = await clientMember.post(`/items/${itemId}/stock-adjustments`, {
      delta: -1,
      reason: 'Bikin kopi pagi untuk berdua',
    });
    assert.strictEqual(adjRes.status, 200);
    assert.strictEqual(Number(adjRes.body.data.newQuantity), 4);

    // -------------------------------------------------------------------------
    // 5. Owner inspects inventory and verifies Member's stock adjustment
    // -------------------------------------------------------------------------
    const ownerReadItem = await clientOwner.get(`/items/${itemId}`);
    assert.strictEqual(ownerReadItem.status, 200);
    assert.strictEqual(Number(ownerReadItem.body.data.quantityOnHand), 4);

    const ownerReadHistory = await clientOwner.get(`/items/${itemId}/stock-adjustments`);
    assert.strictEqual(ownerReadHistory.status, 200);
    assert.strictEqual(ownerReadHistory.body.data[0].notes, 'Bikin kopi pagi untuk berdua');
  });
});
