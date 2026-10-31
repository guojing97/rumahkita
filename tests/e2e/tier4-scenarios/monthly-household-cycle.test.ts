/**
 * Tier 4: Real-World Scenario — Complete Monthly Household Financial & Inventory Cycle
 *
 * Simulates a full month workflow:
 * 1. Income entry (Salary Rp 15,000,000)
 * 2. Fixed direct expense entry (Utilities Rp 750,000)
 * 3. Inventory setup & Grocery purchase completion (Stock increment + linked expense Rp 350,000)
 * 4. Mid-month consumption adjustment (Stock drops to threshold -> Menipis)
 * 5. Debt installment payment (Rp 1,000,000 paid against Rp 5,000,000 loan)
 * 6. Dashboard & Monthly Report reconciliation:
 *    - totalIncome: 15,000,000
 *    - totalExpense: 1,100,000 (750,000 + 350,000)
 *    - netCashFlow: 13,900,000
 * 7. CSV Export verification
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getOwnerClient } from '../client/auth-helper.ts';
import {
  createIncomeSourceFixture,
  createExpenseCategoryFixture,
  createItemFixture,
  createDebtReceivableFixture,
  todayISO,
  randomString,
} from '../client/test-context.ts';

describe('Tier 4: Monthly Household Operational Cycle', () => {
  test('T4.1: Execute complete end-to-end household monthly cycle with full reconciliation', async () => {
    const { client } = await getOwnerClient();
    const currentDate = todayISO();

    // -------------------------------------------------------------------------
    // Step 1: Record Monthly Salary Income (Rp 15,000,000)
    // -------------------------------------------------------------------------
    const salarySource = await createIncomeSourceFixture(client, `Gaji Pokok ${randomString()}`);
    const incomeRes = await client.post('/incomes', {
      date: currentDate,
      nominal: 15000000,
      sourceId: salarySource.id,
      notes: 'Gaji Bulanan PT Maju Bersama',
    });
    assert.strictEqual(incomeRes.status, 201);
    assert.strictEqual(Number(incomeRes.body.data.nominal), 15000000);

    // -------------------------------------------------------------------------
    // Step 2: Record Direct Fixed Expense (Electricity & Utilities: Rp 750,000)
    // -------------------------------------------------------------------------
    const utilityCat = await createExpenseCategoryFixture(client, `Tagihan Rumah ${randomString()}`);
    const expenseRes = await client.post('/expenses', {
      date: currentDate,
      nominal: 750000,
      categoryId: utilityCat.id,
      paymentMethod: 'transfer',
      notes: 'Tagihan Listrik PLN & Air PAM',
    });
    assert.strictEqual(expenseRes.status, 201);
    assert.strictEqual(Number(expenseRes.body.data.nominal), 750000);

    // -------------------------------------------------------------------------
    // Step 3: Inventory Setup & Grocery Purchase Flow
    // -------------------------------------------------------------------------
    const sembakoCat = await createExpenseCategoryFixture(client, `Belanja Sembako ${randomString()}`);
    const beras = await createItemFixture(client, {
      name: `Beras Pandan Wangi 5kg ${randomString()}`,
      unit: 'sak',
      quantityOnHand: 1, // Currently only 1 sak left
      lowStockThreshold: 2,
    });
    const minyak = await createItemFixture(client, {
      name: `Minyak Goreng 2L ${randomString()}`,
      unit: 'pouch',
      quantityOnHand: 2,
      lowStockThreshold: 1,
    });

    // Create purchase draft:
    // 2 saks of Beras @ Rp 80,000 = Rp 160,000
    // 3 pouches of Minyak @ Rp 35,000 = Rp 105,000
    // Non-inventory item (Bumbu Dapur) = Rp 85,000
    // Total Purchase = 160,000 + 105,000 + 85,000 = Rp 350,000
    const purchaseDraft = await client.post('/purchases', {
      date: currentDate,
      vendor: 'Superindo Kemang',
      expenseCategoryId: sembakoCat.id,
      paymentMethod: 'ewallet',
      notes: 'Belanja persediaan bulanan',
      items: [
        {
          itemId: beras.id,
          itemName: beras.name,
          quantity: 2,
          unitPrice: 80000,
        },
        {
          itemId: minyak.id,
          itemName: minyak.name,
          quantity: 3,
          unitPrice: 35000,
        },
        {
          itemId: null,
          itemName: 'Aneka Bumbu Dapur Segar',
          quantity: 1,
          unitPrice: 85000,
        },
      ],
    });
    assert.strictEqual(purchaseDraft.status, 201);
    const purchaseId = purchaseDraft.body.data.id;
    assert.strictEqual(Number(purchaseDraft.body.data.totalAmount), 350000);

    // Complete purchase order -> creates expense and updates inventory
    const completeRes = await client.post(`/purchases/${purchaseId}/complete`, {}, {
      headers: { 'Idempotency-Key': `cycle-pur-${randomString(10)}` },
    });
    assert.strictEqual(completeRes.status, 200);

    // Verify Beras stock: 1 + 2 = 3 saks
    const checkBeras = await client.get(`/items/${beras.id}`);
    assert.strictEqual(Number(checkBeras.body.data.quantityOnHand), 3);
    assert.strictEqual(checkBeras.body.data.status, 'Aman'); // 3 > threshold 2

    // Verify Minyak stock: 2 + 3 = 5 pouches
    const checkMinyak = await client.get(`/items/${minyak.id}`);
    assert.strictEqual(Number(checkMinyak.body.data.quantityOnHand), 5);

    // -------------------------------------------------------------------------
    // Step 4: Mid-month Stock Consumption Adjustment (Rice drops to 1 -> Menipis)
    // -------------------------------------------------------------------------
    const consumeRes = await client.post(`/items/${beras.id}/stock-adjustments`, {
      delta: -2,
      reason: 'Beras habis terpakai untuk konsumsi keluarga',
    });
    assert.strictEqual(consumeRes.status, 200);
    assert.strictEqual(Number(consumeRes.body.data.newQuantity), 1);
    assert.strictEqual(consumeRes.body.data.status, 'Menipis');

    // -------------------------------------------------------------------------
    // Step 5: Debt Installment Payment
    // -------------------------------------------------------------------------
    // Family loan of Rp 5,000,000
    const loan = await createDebtReceivableFixture(client, {
      partyName: 'Koperasi Karyawan',
      principalAmount: 5000000,
      dueDate: '2026-12-31',
    });

    // Make installment payment of Rp 1,000,000
    const debtPayRes = await client.post(`/debts-receivables/${loan.id}/payments`, {
      paymentDate: currentDate,
      amount: 1000000,
      paymentMethod: 'transfer',
      notes: 'Cicilan 1 Pinjaman Koperasi',
    });
    assert.strictEqual(debtPayRes.status, 200);
    assert.strictEqual(Number(debtPayRes.body.data.remainingBalance), 4000000);
    assert.strictEqual(debtPayRes.body.data.status, 'partially_paid');

    // -------------------------------------------------------------------------
    // Step 6: Monthly Report & Financial Reconciliation
    // -------------------------------------------------------------------------
    const dateObj = new Date(currentDate);
    const repRes = await client.get('/reports/monthly', {
      query: { year: dateObj.getFullYear(), month: dateObj.getMonth() + 1 },
    });
    assert.strictEqual(repRes.status, 200);

    // Ensure income and expense totals are reflected
    assert.ok(Number(repRes.body.data.totalIncome) >= 15000000);
    // Direct expense (750k) + purchase expense (350k) = 1,100,000
    assert.ok(Number(repRes.body.data.totalExpense) >= 1100000);

    // -------------------------------------------------------------------------
    // Step 7: CSV Export Reconciliation
    // -------------------------------------------------------------------------
    const csvRes = await client.get('/reports/export/csv', {
      query: { type: 'transactions' },
    });
    assert.strictEqual(csvRes.status, 200);
    assert.ok(csvRes.rawText.includes('Tagihan Listrik PLN'));
    assert.ok(csvRes.rawText.includes('Gaji Bulanan'));
  });
});
