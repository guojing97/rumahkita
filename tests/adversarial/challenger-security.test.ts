/**
 * Comprehensive Adversarial Security & Multi-Tenant Verification Suite
 * Milestone 3: NestJS Backend API
 *
 * Verifies:
 * 1. Multi-Tenant Household Isolation (Incomes, Expenses, Items, Debts, Purchases, Master Data, FK Injections, Header Spoofing)
 * 2. JWT Forgery, Signature Tampering, Wrong Secrets, Algorithm None, Expired Tokens, Nonexistent Users
 * 3. Refresh Token Family Rotation, Replay Detection & Immediate Family Invalidation
 * 4. Single-session Logout and Multi-session Logout-All Revocation
 * 5. Business Boundary Invariants (Negative Nominals, Overpayments, Negative Stock, State Transition Integrity)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ApiClient } from '../e2e/client/api-client.ts';
import { getOwnerClient, getOtherHouseholdClient, loginAs } from '../e2e/client/auth-helper.ts';
import {
  createIncomeSourceFixture,
  createExpenseCategoryFixture,
  createIncomeCategoryFixture,
  createItemFixture,
  createDebtReceivableFixture,
  todayISO,
  randomString,
} from '../e2e/client/test-context.ts';
import { CONFIG } from '../e2e/config.ts';

// Helper to construct custom signed or tampered JWTs
function createRawJwt(header: object, payload: object, secret: string): string {
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64url');
  return `${encHeader}.${encPayload}.${signature}`;
}

describe('Challenger M3: Adversarial Security & Multi-Tenant Verification', () => {
  // =========================================================================
  // SECTION 1: Multi-Tenant Household Isolation Matrix
  // =========================================================================
  describe('1. Multi-Tenant Household Isolation', () => {
    test('1.1 IDOR on Financial & Inventory Entities: User B cannot Read, Update, or Delete User A resources', async () => {
      const { client: clientH1, auth: authH1 } = await getOwnerClient();
      const { client: clientH2, auth: authH2 } = await getOtherHouseholdClient();

      assert.notStrictEqual(
        authH1.household.id,
        authH2.household.id,
        'Household 1 and Household 2 IDs must be distinct'
      );

      // --- Setup Entities in Household 1 ---
      const sourceH1 = await createIncomeSourceFixture(clientH1, `Source H1 ${randomString()}`);
      const catH1 = await createExpenseCategoryFixture(clientH1, `Cat H1 ${randomString()}`);

      // Income in H1
      const incomeRes = await clientH1.post('/incomes', {
        date: todayISO(),
        nominal: 500000,
        sourceId: sourceH1.id,
        notes: 'Secret H1 Income',
      });
      assert.strictEqual(incomeRes.status, 201);
      const incomeIdH1 = incomeRes.body.data.id;

      // Expense in H1
      const expenseRes = await clientH1.post('/expenses', {
        date: todayISO(),
        nominal: 125000,
        categoryId: catH1.id,
        paymentMethod: 'cash',
        notes: 'Secret H1 Expense',
      });
      assert.strictEqual(expenseRes.status, 201);
      const expenseIdH1 = expenseRes.body.data.id;

      // Item in H1
      const itemH1 = await createItemFixture(clientH1, {
        name: `Item H1 ${randomString()}`,
        quantityOnHand: 40,
        lowStockThreshold: 10,
      });

      // Debt in H1
      const debtH1 = await createDebtReceivableFixture(clientH1, {
        type: 'payable',
        principalAmount: 2000000,
      });

      // Purchase draft in H1
      const purchaseRes = await clientH1.post('/purchases', {
        date: todayISO(),
        expenseCategoryId: catH1.id,
        vendor: 'Vendor H1',
        paymentMethod: 'transfer',
        items: [
          {
            itemId: itemH1.id,
            itemName: itemH1.name,
            quantity: 5,
            unitPrice: 10000,
          },
        ],
      });
      assert.strictEqual(purchaseRes.status, 201);
      const purchaseIdH1 = purchaseRes.body.data.id;

      // --- Attacks by User B (Household 2) ---

      // Attack: Income
      const readIncome = await clientH2.get(`/incomes/${incomeIdH1}`);
      assert.ok(
        [403, 404].includes(readIncome.status),
        `User B read H1 income: expected 403/404, got ${readIncome.status}`
      );

      const updateIncome = await clientH2.put(`/incomes/${incomeIdH1}`, {
        nominal: 99999999,
      });
      assert.ok(
        [403, 404].includes(updateIncome.status),
        `User B update H1 income: expected 403/404, got ${updateIncome.status}`
      );

      const deleteIncome = await clientH2.delete(`/incomes/${incomeIdH1}`);
      assert.ok(
        [403, 404].includes(deleteIncome.status),
        `User B delete H1 income: expected 403/404, got ${deleteIncome.status}`
      );

      // Attack: Expense
      const readExpense = await clientH2.get(`/expenses/${expenseIdH1}`);
      assert.ok(
        [403, 404].includes(readExpense.status),
        `User B read H1 expense: expected 403/404, got ${readExpense.status}`
      );

      const updateExpense = await clientH2.put(`/expenses/${expenseIdH1}`, {
        nominal: 888888,
      });
      assert.ok(
        [403, 404].includes(updateExpense.status),
        `User B update H1 expense: expected 403/404, got ${updateExpense.status}`
      );

      const deleteExpense = await clientH2.delete(`/expenses/${expenseIdH1}`);
      assert.ok(
        [403, 404].includes(deleteExpense.status),
        `User B delete H1 expense: expected 403/404, got ${deleteExpense.status}`
      );

      // Attack: Item & Stock Adjustment
      const readItem = await clientH2.get(`/items/${itemH1.id}`);
      assert.ok(
        [403, 404].includes(readItem.status),
        `User B read H1 item: expected 403/404, got ${readItem.status}`
      );

      const updateItem = await clientH2.put(`/items/${itemH1.id}`, {
        name: 'Hacked Item Name',
      });
      assert.ok(
        [403, 404].includes(updateItem.status),
        `User B update H1 item: expected 403/404, got ${updateItem.status}`
      );

      const adjustItem = await clientH2.post(`/items/${itemH1.id}/stock-adjustments`, {
        delta: -15,
        reason: 'Malicious adjustment by User B',
      });
      assert.ok(
        [403, 404].includes(adjustItem.status),
        `User B adjust H1 item: expected 403/404, got ${adjustItem.status}`
      );

      const deleteItem = await clientH2.delete(`/items/${itemH1.id}`);
      assert.ok(
        [403, 404].includes(deleteItem.status),
        `User B delete H1 item: expected 403/404, got ${deleteItem.status}`
      );

      // Attack: Debt & Payment
      const readDebt = await clientH2.get(`/debts-receivables/${debtH1.id}`);
      assert.ok(
        [403, 404].includes(readDebt.status),
        `User B read H1 debt: expected 403/404, got ${readDebt.status}`
      );

      const payDebt = await clientH2.post(`/debts-receivables/${debtH1.id}/payments`, {
        paymentDate: todayISO(),
        amount: 500000,
      });
      assert.ok(
        [403, 404].includes(payDebt.status),
        `User B pay H1 debt: expected 403/404, got ${payDebt.status}`
      );

      const deleteDebt = await clientH2.delete(`/debts-receivables/${debtH1.id}`);
      assert.ok(
        [403, 404].includes(deleteDebt.status),
        `User B delete H1 debt: expected 403/404, got ${deleteDebt.status}`
      );

      // Attack: Purchase & Completion/Cancellation
      const readPurchase = await clientH2.get(`/purchases/${purchaseIdH1}`);
      assert.ok(
        [403, 404].includes(readPurchase.status),
        `User B read H1 purchase: expected 403/404, got ${readPurchase.status}`
      );

      const completePurchase = await clientH2.post(
        `/purchases/${purchaseIdH1}/complete`,
        {},
        { headers: { 'Idempotency-Key': `adv-h2-key-${randomString(8)}` } }
      );
      assert.ok(
        [403, 404].includes(completePurchase.status),
        `User B complete H1 purchase: expected 403/404, got ${completePurchase.status}`
      );

      const cancelPurchase = await clientH2.post(`/purchases/${purchaseIdH1}/cancel`, {
        reason: 'Malicious cancellation attempt by User B',
      });
      assert.ok(
        [403, 404].includes(cancelPurchase.status),
        `User B cancel H1 purchase: expected 403/404, got ${cancelPurchase.status}`
      );

      // Verify Household 1 item stock was completely unaffected (remains 40)
      const verifyItemH1 = await clientH1.get(`/items/${itemH1.id}`);
      assert.strictEqual(verifyItemH1.status, 200);
      assert.strictEqual(Number(verifyItemH1.body.data.quantityOnHand), 40);

      // Verify Household 1 debt balance was completely unaffected (remains 2000000)
      const verifyDebtH1 = await clientH1.get(`/debts-receivables/${debtH1.id}`);
      assert.strictEqual(verifyDebtH1.status, 200);
      assert.strictEqual(Number(verifyDebtH1.body.data.remainingBalance), 2000000);

      // Verify Household 1 purchase remains 'draft'
      const verifyPurchaseH1 = await clientH1.get(`/purchases/${purchaseIdH1}`);
      assert.strictEqual(verifyPurchaseH1.status, 200);
      assert.strictEqual(verifyPurchaseH1.body.data.status, 'draft');
    });

    test('1.2 Cross-Household Foreign Key Injection: User B cannot reference H1 master entities', async () => {
      const { client: clientH1 } = await getOwnerClient();
      const { client: clientH2 } = await getOtherHouseholdClient();

      const sourceH1 = await createIncomeSourceFixture(clientH1, `Source FK ${randomString()}`);
      const catH1 = await createExpenseCategoryFixture(clientH1, `Cat FK ${randomString()}`);

      // User B attempts to create Income using H1's sourceId
      const spoofIncome = await clientH2.post('/incomes', {
        date: todayISO(),
        nominal: 200000,
        sourceId: sourceH1.id,
      });
      assert.ok(
        [400, 403, 404, 422].includes(spoofIncome.status),
        `User B injected H1 sourceId into income: expected rejection, got ${spoofIncome.status}`
      );

      // User B attempts to create Expense using H1's categoryId
      const spoofExpense = await clientH2.post('/expenses', {
        date: todayISO(),
        nominal: 150000,
        categoryId: catH1.id,
      });
      assert.ok(
        [400, 403, 404, 422].includes(spoofExpense.status),
        `User B injected H1 categoryId into expense: expected rejection, got ${spoofExpense.status}`
      );

      // User B attempts to create Purchase draft using H1's expenseCategoryId
      const spoofPurchase = await clientH2.post('/purchases', {
        date: todayISO(),
        expenseCategoryId: catH1.id,
        items: [{ itemName: 'Item X', quantity: 1, unitPrice: 50000 }],
      });
      assert.ok(
        [400, 403, 404, 422].includes(spoofPurchase.status),
        `User B injected H1 categoryId into purchase: expected rejection, got ${spoofPurchase.status}`
      );
    });

    test('1.3 Tenant Header Spoofing (X-Household-Id): Must be strictly rejected with HTTP 403', async () => {
      const { client: clientH1, auth: authH1 } = await getOwnerClient();
      const { client: clientH2 } = await getOtherHouseholdClient();

      const targetH1Id = authH1.household.id;
      const spoofHeader = { 'X-Household-Id': targetH1Id };

      const endpoints = [
        '/household',
        '/incomes',
        '/expenses',
        '/items',
        '/debts-receivables',
        '/purchases',
        '/dashboard/summary',
        '/reports/monthly',
        '/reports/yearly',
        '/reports/export/csv',
      ];

      for (const ep of endpoints) {
        const res = await clientH2.get(ep, { headers: spoofHeader });
        assert.strictEqual(
          res.status,
          403,
          `Endpoint ${ep} with spoofed X-Household-Id must return 403 Forbidden, got ${res.status}`
        );
      }

      // Query parameter spoofing (?householdId=<targetH1Id>)
      const querySpoof = await clientH2.get(`/incomes?householdId=${targetH1Id}`);
      assert.strictEqual(
        querySpoof.status,
        403,
        `Endpoint /incomes with spoofed ?householdId query must return 403 Forbidden, got ${querySpoof.status}`
      );
    });
  });

  // =========================================================================
  // SECTION 2: Authentication & Token Security
  // =========================================================================
  describe('2. Authentication & Token Security', () => {
    test('2.1 JWT Signature Tampering & Forgery: Must return HTTP 401 Unauthorized', async () => {
      const unauthClient = new ApiClient();

      // Case A: Missing Authorization header
      const noAuth = await unauthClient.get('/household');
      assert.strictEqual(noAuth.status, 401, 'Missing token must return 401');

      // Case B: Header present but not 'Bearer '
      const badHeader = await unauthClient.get('/household', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      assert.strictEqual(badHeader.status, 401, 'Non-Bearer auth must return 401');

      // Case C: Malformed JWT string
      const malformedClient = new ApiClient();
      malformedClient.setBearerToken('not.a.valid.jwt.token');
      const malformedRes = await malformedClient.get('/household');
      assert.strictEqual(malformedRes.status, 401, 'Malformed JWT must return 401');

      // Case D: Valid JWT structure signed with WRONG SECRET
      const forgedWrongSecret = createRawJwt(
        { alg: 'HS256', typ: 'JWT' },
        {
          sub: CONFIG.SEEDED_USERS.OWNER.email,
          email: CONFIG.SEEDED_USERS.OWNER.email,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        'malicious_attacker_wrong_secret_key_123456789'
      );
      const wrongSecretClient = new ApiClient();
      wrongSecretClient.setBearerToken(forgedWrongSecret);
      const wrongSecretRes = await wrongSecretClient.get('/household');
      assert.strictEqual(wrongSecretRes.status, 401, 'Wrong secret signature must return 401');

      // Case E: Algorithm 'none' attack
      const algNoneToken =
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') +
        '.' +
        Buffer.from(
          JSON.stringify({
            sub: '00000000-0000-4000-a000-000000000011',
            email: 'budi@rumahkita.local',
            exp: Math.floor(Date.now() / 1000) + 3600,
          })
        ).toString('base64url') +
        '.';
      const algNoneClient = new ApiClient();
      algNoneClient.setBearerToken(algNoneToken);
      const algNoneRes = await algNoneClient.get('/household');
      assert.strictEqual(algNoneRes.status, 401, 'Algorithm none attack must return 401');

      // Case F: Legitimate signature but EXPIRED token
      const expiredToken = createRawJwt(
        { alg: 'HS256', typ: 'JWT' },
        {
          sub: '00000000-0000-4000-a000-000000000011',
          email: 'budi@rumahkita.local',
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        },
        process.env.JWT_SECRET || 'rumahkita_super_secret_jwt_key_2026'
      );
      const expiredClient = new ApiClient();
      expiredClient.setBearerToken(expiredToken);
      const expiredRes = await expiredClient.get('/household');
      assert.strictEqual(expiredRes.status, 401, 'Expired token must return 401');

      // Case G: Valid signature & expiration but NONEXISTENT user UUID
      const nonExistentUserToken = createRawJwt(
        { alg: 'HS256', typ: 'JWT' },
        {
          sub: '00000000-0000-4000-b999-999999999999',
          email: 'ghost@rumahkita.local',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        process.env.JWT_SECRET || 'rumahkita_super_secret_jwt_key_2026'
      );
      const nonExistentUserClient = new ApiClient();
      nonExistentUserClient.setBearerToken(nonExistentUserToken);
      const nonExistentUserRes = await nonExistentUserClient.get('/household');
      assert.strictEqual(nonExistentUserRes.status, 401, 'Non-existent user must return 401');
    });

    test('2.2 Refresh Token Rotation & Family Reuse Invalidation: Replaying old token revokes entire family', async () => {
      const client = new ApiClient();
      await loginAs(client, CONFIG.SEEDED_USERS.OWNER.email, CONFIG.SEEDED_USERS.OWNER.password);

      // Step 1: Capture Token 1
      const token1 = client.cookieJar.getCookie('refreshToken');
      assert.ok(token1, 'Token 1 must be present in cookie');

      // Step 2: First legitimate rotation: Token 1 -> Token 2
      const rotRes1 = await client.post('/auth/refresh');
      assert.strictEqual(rotRes1.status, 200, 'First refresh must succeed');
      const token2 = client.cookieJar.getCookie('refreshToken');
      assert.ok(token2, 'Token 2 must be present');
      assert.notStrictEqual(token1, token2, 'Token 2 must be different from Token 1');

      // Step 3: Second legitimate rotation: Token 2 -> Token 3
      const rotRes2 = await client.post('/auth/refresh');
      assert.strictEqual(rotRes2.status, 200, 'Second refresh must succeed');
      const token3 = client.cookieJar.getCookie('refreshToken');
      assert.ok(token3, 'Token 3 must be present');
      assert.notStrictEqual(token2, token3, 'Token 3 must be different from Token 2');

      // Step 4: Replay Attack: Attacker steals and replays Token 1 (already rotated)
      const attackerClient = new ApiClient();
      attackerClient.cookieJar.setCookie('refreshToken', token1!);
      const replayRes = await attackerClient.post('/auth/refresh');
      assert.strictEqual(
        replayRes.status,
        401,
        `Replay of revoked Token 1 must return 401, got ${replayRes.status}`
      );

      // Step 5: Verification of Token Family Invalidation:
      // Even the legitimate user with Token 3 must now be denied because family is compromised!
      const victimClient = new ApiClient();
      victimClient.cookieJar.setCookie('refreshToken', token3!);
      const victimRes = await victimClient.post('/auth/refresh');
      assert.strictEqual(
        victimRes.status,
        401,
        `Compromised token family must invalidate Token 3 with 401, got ${victimRes.status}`
      );
    });

    test('2.3 Single-Session Logout: Revokes active refresh session and clears cookie', async () => {
      const client = new ApiClient();
      await loginAs(client, CONFIG.SEEDED_USERS.OWNER.email, CONFIG.SEEDED_USERS.OWNER.password);

      const activeRefreshToken = client.cookieJar.getCookie('refreshToken');
      assert.ok(activeRefreshToken, 'Refresh token must exist before logout');

      // Call Logout
      const logoutRes = await client.post('/auth/logout');
      assert.strictEqual(logoutRes.status, 200);

      // Verify Refresh with logged-out token fails with 401
      const reattemptClient = new ApiClient();
      reattemptClient.cookieJar.setCookie('refreshToken', activeRefreshToken!);
      const refreshRes = await reattemptClient.post('/auth/refresh');
      assert.strictEqual(
        refreshRes.status,
        401,
        `Refresh after logout must return 401, got ${refreshRes.status}`
      );
    });

    test('2.4 Multi-Session Logout-All: Revokes all active refresh sessions across devices', async () => {
      // Device A
      const clientA = new ApiClient();
      const authA = await loginAs(
        clientA,
        CONFIG.SEEDED_USERS.OWNER.email,
        CONFIG.SEEDED_USERS.OWNER.password
      );
      const rtA = clientA.cookieJar.getCookie('refreshToken');

      // Device B
      const clientB = new ApiClient();
      await loginAs(
        clientB,
        CONFIG.SEEDED_USERS.OWNER.email,
        CONFIG.SEEDED_USERS.OWNER.password
      );
      const rtB = clientB.cookieJar.getCookie('refreshToken');

      assert.notStrictEqual(rtA, rtB, 'Device A and Device B must have distinct session tokens');

      // Device A issues logout-all
      const logoutAllRes = await clientA.post('/auth/logout-all');
      assert.strictEqual(logoutAllRes.status, 200);

      // Verify Device A session cannot refresh
      const testClientA = new ApiClient();
      testClientA.cookieJar.setCookie('refreshToken', rtA!);
      const refreshA = await testClientA.post('/auth/refresh');
      assert.strictEqual(refreshA.status, 401, 'Device A session must be revoked after logout-all');

      // Verify Device B session cannot refresh
      const testClientB = new ApiClient();
      testClientB.cookieJar.setCookie('refreshToken', rtB!);
      const refreshB = await testClientB.post('/auth/refresh');
      assert.strictEqual(refreshB.status, 401, 'Device B session must be revoked after logout-all');
    });
  });

  // =========================================================================
  // SECTION 3: Business Boundary Invariants
  // =========================================================================
  describe('3. Business Boundary Invariants', () => {
    test('3.1 Financial Boundary: Zero & Negative Nominals Rejected with 422', async () => {
      const { client } = await getOwnerClient();
      const source = await createIncomeSourceFixture(client);
      const category = await createExpenseCategoryFixture(client);

      // Income <= 0
      const incZero = await client.post('/incomes', {
        date: todayISO(),
        nominal: 0,
        sourceId: source.id,
      });
      assert.strictEqual(incZero.status, 422, 'Income nominal 0 must return 422');

      const incNeg = await client.post('/incomes', {
        date: todayISO(),
        nominal: -50000,
        sourceId: source.id,
      });
      assert.strictEqual(incNeg.status, 422, 'Income nominal -50000 must return 422');

      // Expense <= 0
      const expZero = await client.post('/expenses', {
        date: todayISO(),
        nominal: 0,
        categoryId: category.id,
      });
      assert.strictEqual(expZero.status, 422, 'Expense nominal 0 must return 422');

      const expNeg = await client.post('/expenses', {
        date: todayISO(),
        nominal: -25000,
        categoryId: category.id,
      });
      assert.strictEqual(expNeg.status, 422, 'Expense nominal -25000 must return 422');
    });

    test('3.2 Inventory Boundary: Negative Stock Prevention', async () => {
      const { client } = await getOwnerClient();
      const item = await createItemFixture(client, { quantityOnHand: 5 });

      // Stock adjustment that would reduce stock below 0
      const res = await client.post(`/items/${item.id}/stock-adjustments`, {
        delta: -10,
        reason: 'Illegal reduction below zero',
      });
      assert.strictEqual(res.status, 422, 'Adjustment resulting in negative stock must return 422');

      // Verify stock untouched
      const verifyItem = await client.get(`/items/${item.id}`);
      assert.strictEqual(Number(verifyItem.body.data.quantityOnHand), 5);
    });

    test('3.3 Debts Boundary: Overpayment & Non-Positive Payments Rejected with 422', async () => {
      const { client } = await getOwnerClient();
      const debt = await createDebtReceivableFixture(client, { principalAmount: 500000 });

      // Overpayment
      const overpay = await client.post(`/debts-receivables/${debt.id}/payments`, {
        paymentDate: todayISO(),
        amount: 600000,
      });
      assert.strictEqual(overpay.status, 422, 'Payment exceeding balance must return 422');

      // Non-positive payment
      const zeroPay = await client.post(`/debts-receivables/${debt.id}/payments`, {
        paymentDate: todayISO(),
        amount: 0,
      });
      assert.strictEqual(zeroPay.status, 422, 'Payment amount 0 must return 422');

      const negPay = await client.post(`/debts-receivables/${debt.id}/payments`, {
        paymentDate: todayISO(),
        amount: -100000,
      });
      assert.strictEqual(negPay.status, 422, 'Negative payment amount must return 422');
    });

    test('3.4 Purchase State Machine: Completed/Cancelled state cannot be illegally transitioned', async () => {
      const { client } = await getOwnerClient();
      const cat = await createExpenseCategoryFixture(client);
      const item = await createItemFixture(client, { quantityOnHand: 10 });

      // Create draft purchase
      const draft = await client.post('/purchases', {
        date: todayISO(),
        expenseCategoryId: cat.id,
        items: [{ itemId: item.id, itemName: item.name, quantity: 2, unitPrice: 20000 }],
      });
      const pId = draft.body.data.id;

      // Complete purchase
      const comp = await client.post(
        `/purchases/${pId}/complete`,
        {},
        { headers: { 'Idempotency-Key': `sm-${randomString(10)}` } }
      );
      assert.strictEqual(comp.status, 200);

      // Attempt to cancel completed purchase -> 400
      const cancelAttempt = await client.post(`/purchases/${pId}/cancel`, {
        reason: 'Cancelling completed purchase test',
      });
      assert.strictEqual(cancelAttempt.status, 400, 'Completed purchase cannot be cancelled');

      // Attempt to complete completed purchase with DIFFERENT key -> 400
      const compAgain = await client.post(
        `/purchases/${pId}/complete`,
        {},
        { headers: { 'Idempotency-Key': `diff-${randomString(10)}` } }
      );
      assert.strictEqual(compAgain.status, 400, 'Re-completing with different key must return 400');
    });
  });
});
