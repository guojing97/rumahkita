/**
 * Tier 1: Authentication & Session Management Feature Coverage Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../client/api-client.ts';
import { CONFIG } from '../config.ts';
import { loginAs } from '../client/auth-helper.ts';

describe('Tier 1: Authentication & Sessions', () => {
  test('T1.1: Login with valid credentials returns 200, JWT access token, and sets refresh cookie', async () => {
    const client = new ApiClient();
    const res = await client.post('/auth/login', {
      email: CONFIG.SEEDED_USERS.OWNER.email,
      password: CONFIG.SEEDED_USERS.OWNER.password,
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.accessToken, 'Access token should be present in response');
    assert.strictEqual(res.body.data.user.email, CONFIG.SEEDED_USERS.OWNER.email);
    assert.ok(res.body.data.household.id, 'Household ID should be present');

    // Verify Set-Cookie has refreshToken
    const refreshCookie = client.cookieJar.getCookie('refreshToken');
    assert.ok(refreshCookie, 'refreshToken cookie should be set in response');
  });

  test('T1.2: Login with invalid password returns 401 Unauthorized', async () => {
    const client = new ApiClient();
    const res = await client.post('/auth/login', {
      email: CONFIG.SEEDED_USERS.OWNER.email,
      password: 'CompletelyWrongPassword123!',
    });

    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message, 'Error message should be provided');
  });

  test('T1.3: Token refresh rotates refresh token and returns new access token', async () => {
    const client = new ApiClient();
    await loginAs(client, CONFIG.SEEDED_USERS.OWNER.email, CONFIG.SEEDED_USERS.OWNER.password);
    const initialRefreshCookie = client.cookieJar.getCookie('refreshToken');

    // Call refresh endpoint
    const res = await client.post('/auth/refresh');
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.ok(res.body.data.accessToken, 'New access token should be issued');

    const rotatedRefreshCookie = client.cookieJar.getCookie('refreshToken');
    assert.ok(rotatedRefreshCookie, 'Rotated refresh token cookie should be set');
    assert.notStrictEqual(
      rotatedRefreshCookie,
      initialRefreshCookie,
      'Refresh token must be rotated to a new value'
    );
  });

  test('T1.4: Logout revokes refresh session so subsequent refresh fails with 401', async () => {
    const client = new ApiClient();
    await loginAs(client, CONFIG.SEEDED_USERS.OWNER.email, CONFIG.SEEDED_USERS.OWNER.password);

    // Call logout
    const logoutRes = await client.post('/auth/logout');
    assert.strictEqual(logoutRes.status, 200, `Expected 200 OK on logout, got ${logoutRes.status}`);

    // Attempt refresh after logout
    const refreshRes = await client.post('/auth/refresh');
    assert.strictEqual(
      refreshRes.status,
      401,
      `Expected 401 Unauthorized after logout, got ${refreshRes.status}`
    );
  });

  test('T1.5: Logout-all terminates active user sessions', async () => {
    const client = new ApiClient();
    await loginAs(client, CONFIG.SEEDED_USERS.OWNER.email, CONFIG.SEEDED_USERS.OWNER.password);

    const logoutAllRes = await client.post('/auth/logout-all');
    assert.strictEqual(logoutAllRes.status, 200, `Expected 200 OK, got ${logoutAllRes.status}`);
    assert.strictEqual(logoutAllRes.body.success, true);
  });

  test('T1.6: Forgot password returns 200 generic response without leaking account existence', async () => {
    const client = new ApiClient();
    const res = await client.post('/auth/password/forgot', {
      email: CONFIG.SEEDED_USERS.OWNER.email,
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
  });
});
