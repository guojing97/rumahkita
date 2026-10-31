/**
 * Tier 3: Complete Multi-Tenant Household Data Isolation Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient, getOtherHouseholdClient } from '../client/auth-helper.ts';
import {
  createIncomeSourceFixture,
  createExpenseCategoryFixture,
  createItemFixture,
  createDebtReceivableFixture,
  todayISO,
} from '../client/test-context.ts';

describe('Tier 3: Multi-Tenant Data Isolation Guard', () => {
  test('T3.7: Strict data isolation across all financial and inventory entities', async () => {
    const { client: clientH1 } = await getOwnerClient();
    const { client: clientH2 } = await getOtherHouseholdClient();

    // 1. Household 1 creates an Item
    const itemH1 = await createItemFixture(clientH1, { name: 'Item Khusus H1' });

    // Household 2 attempts to read and adjust Household 1's item
    const readItemH2 = await clientH2.get(`/items/${itemH1.id}`);
    assert.ok([403, 404].includes(readItemH2.status));

    const adjItemH2 = await clientH2.post(`/items/${itemH1.id}/stock-adjustments`, {
      delta: -1,
      reason: 'Illegal adjustment from other household',
    });
    assert.ok([403, 404].includes(adjItemH2.status));

    // 2. Household 1 creates an Expense
    const catH1 = await createExpenseCategoryFixture(clientH1);
    const expH1 = await clientH1.post('/expenses', {
      date: todayISO(),
      nominal: 250000,
      categoryId: catH1.id,
      notes: 'Expense Rahasia H1',
    });
    const expIdH1 = expH1.body.data.id;

    // Household 2 attempts to read and delete Household 1's expense
    const readExpH2 = await clientH2.get(`/expenses/${expIdH1}`);
    assert.ok([403, 404].includes(readExpH2.status));

    const delExpH2 = await clientH2.delete(`/expenses/${expIdH1}`);
    assert.ok([403, 404].includes(delExpH2.status));

    // 3. Household 1 creates a Debt
    const debtH1 = await createDebtReceivableFixture(clientH1, { principalAmount: 5000000 });

    // Household 2 attempts to record payment on Household 1's debt
    const payDebtH2 = await clientH2.post(`/debts-receivables/${debtH1.id}/payments`, {
      paymentDate: todayISO(),
      amount: 1000000,
    });
    assert.ok([403, 404].includes(payDebtH2.status));
  });
});
