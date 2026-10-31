/**
 * Tier 2: Security Boundaries & Multi-Tenant Authorization Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../client/api-client.ts';
import { getOwnerClient, getOtherHouseholdClient, loginAs } from '../client/auth-helper.ts';
import { createIncomeSourceFixture, todayISO } from '../client/test-context.ts';
import { CONFIG } from '../config.ts';

describe('Tier 2: Security & Authorization Boundaries', () => {
  test('T2.14: Protected endpoint without Bearer token returns 401 Unauthorized', async () => {
    const unauthenticatedClient = new ApiClient();
    const res = await unauthenticatedClient.get('/household');

    assert.strictEqual(
      res.status,
      401,
      `Expected 401 for unauthenticated request, got ${res.status}`
    );
    assert.strictEqual(res.body.success, false);
  });

  test('T2.15: Protected endpoint with forged/tampered JWT returns 401 Unauthorized', async () => {
    const maliciousClient = new ApiClient();
    maliciousClient.setBearerToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');

    const res = await maliciousClient.get('/household');
    assert.strictEqual(res.status, 401, `Expected 401 for forged JWT, got ${res.status}`);
  });

  test('T2.16: API request with valid token but accessing another household\'s data returns 403 Forbidden', async () => {
    const { client: clientH1 } = await getOwnerClient();
    const { client: clientH2 } = await getOtherHouseholdClient();

    // Household 1 creates an income record
    const sourceH1 = await createIncomeSourceFixture(clientH1);
    const incomeResH1 = await clientH1.post('/incomes', {
      date: todayISO(),
      nominal: 1000000,
      sourceId: sourceH1.id,
      notes: 'H1 confidential income',
    });
    const incomeIdH1 = incomeResH1.body.data.id;

    // Household 2 attempts to read Household 1's income record
    const attackRes = await clientH2.get(`/incomes/${incomeIdH1}`);
    assert.ok(
      [403, 404].includes(attackRes.status),
      `Expected 403 Forbidden or 404 Not Found for cross-household access, got ${attackRes.status}`
    );

    // Household 2 attempts to delete Household 1's income record
    const deleteAttack = await clientH2.delete(`/incomes/${incomeIdH1}`);
    assert.ok(
      [403, 404].includes(deleteAttack.status),
      `Expected 403 or 404 on cross-household mutation, got ${deleteAttack.status}`
    );
  });

  test('T2.17: Refresh token reuse detection revokes entire token family', async () => {
    const client = new ApiClient();
    await loginAs(client, CONFIG.SEEDED_USERS.OWNER.email, CONFIG.SEEDED_USERS.OWNER.password);

    // Capture the first refresh token
    const tokenV1 = client.cookieJar.getCookie('refreshToken');
    assert.ok(tokenV1, 'Initial refresh token must exist');

    // Perform legitimate refresh -> rotates to tokenV2
    const refreshRes = await client.post('/auth/refresh');
    assert.strictEqual(refreshRes.status, 200);
    const tokenV2 = client.cookieJar.getCookie('refreshToken');
    assert.notStrictEqual(tokenV1, tokenV2);

    // Replay attack: client attempts to use tokenV1 again
    const replayClient = new ApiClient();
    replayClient.cookieJar.setCookie('refreshToken', tokenV1);

    const replayRes = await replayClient.post('/auth/refresh');
    assert.strictEqual(
      replayRes.status,
      401,
      `Expected 401 on token reuse attempt, got ${replayRes.status}`
    );

    // Due to reuse detection, the entire family should now be revoked; tokenV2 should also fail
    client.cookieJar.setCookie('refreshToken', tokenV2!);
    const subsequentRes = await client.post('/auth/refresh');
    assert.strictEqual(
      subsequentRes.status,
      401,
      `Expected 401 on token from compromised family, got ${subsequentRes.status}`
    );
  });
});
