/**
 * Tier 2: Authentication Login Throttle & Rate Limiting Integration Tests
 *
 * Acceptance Criteria:
 * 1. Percobaan 1 & 2 Gagal: Mengembalikan HTTP 401 Unauthorized, pesan "Email atau password salah".
 * 2. Percobaan ke-3 Gagal: Mengembalikan HTTP 429 Too Many Requests, header Retry-After: 180, pesan 180 detik.
 * 3. Percobaan ke-4 (saat lockout aktif): Langsung ditolak HTTP 429 Too Many Requests dengan header Retry-After sisa durasi.
 * 4. Login sukses setelah gagal: Mereset counter kegagalan ke 0.
 * 5. Email yang belum terdaftar: Tetap terkena limit 3x (anti-enumeration).
 * 6. Case & whitespace normalization: Email case insensitivity and whitespace trimming share throttle key.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../client/api-client.ts';
import { randomString } from '../client/test-context.ts';
import { CONFIG } from '../config.ts';

describe('Tier 2: Authentication Login Throttle & Rate Limiting', () => {
  const seededEmail = process.env.TEST_USER_OWNER_EMAIL || 'hendrawankevin97@gmail.com';
  const seededPassword = process.env.TEST_USER_OWNER_PASSWORD || 'e5f6g7h8';

  test('AC-1: Percobaan 1 & 2 Gagal mengembalikan HTTP 401 Unauthorized dengan pesan "Email atau password salah"', async () => {
    const client = new ApiClient();
    const testEmail = `qa-throttle-ac1-${randomString()}@example.com`;

    // Attempt 1
    const res1 = await client.post('/auth/login', {
      email: testEmail,
      password: 'WrongPassword123!',
    });

    assert.strictEqual(res1.status, 401, `Attempt 1: Expected 401 Unauthorized, got ${res1.status}`);
    assert.strictEqual(res1.body.success, false);
    assert.strictEqual(res1.body.message, 'Email atau password salah');
    assert.strictEqual(res1.headers.get('retry-after'), null, 'Attempt 1 should not have Retry-After header');

    // Attempt 2
    const res2 = await client.post('/auth/login', {
      email: testEmail,
      password: 'WrongPassword456!',
    });

    assert.strictEqual(res2.status, 401, `Attempt 2: Expected 401 Unauthorized, got ${res2.status}`);
    assert.strictEqual(res2.body.success, false);
    assert.strictEqual(res2.body.message, 'Email atau password salah');
    assert.strictEqual(res2.headers.get('retry-after'), null, 'Attempt 2 should not have Retry-After header');
  });

  test('AC-2: Percobaan ke-3 Gagal mengembalikan HTTP 429 Too Many Requests, header Retry-After: 180, dan pesan lockout', async () => {
    const client = new ApiClient();
    const testEmail = `qa-throttle-ac2-${randomString()}@example.com`;

    // Attempts 1 & 2
    await client.post('/auth/login', { email: testEmail, password: 'WrongPassword1!' });
    await client.post('/auth/login', { email: testEmail, password: 'WrongPassword2!' });

    // Attempt 3
    const res3 = await client.post('/auth/login', {
      email: testEmail,
      password: 'WrongPassword3!',
    });

    assert.strictEqual(res3.status, 429, `Attempt 3: Expected 429 Too Many Requests, got ${res3.status}`);
    assert.strictEqual(res3.body.success, false);
    assert.strictEqual(res3.body.statusCode, 429);
    assert.strictEqual(res3.body.error, 'Too Many Requests');
    assert.strictEqual(res3.body.retryAfter, 180, 'retryAfter in body must be 180');

    const retryAfterHeader = res3.headers.get('retry-after');
    assert.ok(retryAfterHeader, 'Retry-After header must be present');
    assert.strictEqual(retryAfterHeader, '180', 'Retry-After header must be "180"');
    assert.match(
      res3.body.message,
      /180 detik/i,
      `Message should state waiting time in seconds, got: "${res3.body.message}"`
    );
  });

  test('AC-3: Percobaan ke-4 saat lockout aktif langsung ditolak HTTP 429 dengan header Retry-After sisa durasi', async () => {
    const client = new ApiClient();
    const testEmail = `qa-throttle-ac3-${randomString()}@example.com`;

    // 3 failed attempts to trigger lockout
    for (let i = 1; i <= 3; i++) {
      await client.post('/auth/login', { email: testEmail, password: `WrongPassword${i}!` });
    }

    // Attempt 4 immediately during active lockout (even with arbitrary password)
    const res4 = await client.post('/auth/login', {
      email: testEmail,
      password: 'AnyPassword123!',
    });

    assert.strictEqual(res4.status, 429, `Attempt 4: Expected 429 Too Many Requests during lockout, got ${res4.status}`);
    assert.strictEqual(res4.body.success, false);
    assert.strictEqual(res4.body.statusCode, 429);

    const retryAfterHeader = res4.headers.get('retry-after');
    assert.ok(retryAfterHeader, 'Retry-After header must be present on 4th attempt');
    const retryAfterVal = Number(retryAfterHeader);
    assert.ok(
      !Number.isNaN(retryAfterVal) && retryAfterVal > 0 && retryAfterVal <= 180,
      `Retry-After header value (${retryAfterHeader}) must be a valid remaining second between 1 and 180`
    );
    assert.strictEqual(res4.body.retryAfter, retryAfterVal);
  });

  test('AC-4: Login sukses setelah 1 atau 2 kali gagal mereset counter kegagalan ke 0', async () => {
    const client = new ApiClient();
    // Use unique account by registering a new one to avoid polluting other suites
    const uniqueEmail = `qa-reset-${randomString()}@example.com`;
    const userPassword = 'CorrectPassword123!';

    // Register user
    const regRes = await client.post('/auth/register', {
      email: uniqueEmail,
      password: userPassword,
      fullName: 'QA Reset Test User',
    });
    assert.strictEqual(regRes.status, 201, `Registration failed with ${regRes.status}: ${JSON.stringify(regRes.body)}`);

    // Perform 2 failed login attempts
    const fail1 = await client.post('/auth/login', { email: uniqueEmail, password: 'WrongPassword1!' });
    assert.strictEqual(fail1.status, 401);

    const fail2 = await client.post('/auth/login', { email: uniqueEmail, password: 'WrongPassword2!' });
    assert.strictEqual(fail2.status, 401);

    // 3rd attempt is SUCCESSFUL
    const successClient = new ApiClient();
    const successRes = await successClient.post('/auth/login', {
      email: uniqueEmail,
      password: userPassword,
    });
    assert.strictEqual(successRes.status, 200, 'Login with correct credentials must succeed');
    assert.strictEqual(successRes.body.success, true);
    assert.ok(successRes.body.data.accessToken);

    // After successful login, failure counter must be RESET to 0.
    // Next failed attempt should be treated as Attempt 1 (401 Unauthorized, NOT 429).
    const failAfterReset1 = await client.post('/auth/login', { email: uniqueEmail, password: 'WrongPasswordAgain!' });
    assert.strictEqual(
      failAfterReset1.status,
      401,
      `Expected 401 on first failure after reset, got ${failAfterReset1.status}`
    );
    assert.strictEqual(failAfterReset1.headers.get('retry-after'), null);

    // Next failure is Attempt 2 -> 401
    const failAfterReset2 = await client.post('/auth/login', { email: uniqueEmail, password: 'WrongPasswordAgain2!' });
    assert.strictEqual(
      failAfterReset2.status,
      401,
      `Expected 401 on second failure after reset, got ${failAfterReset2.status}`
    );
    assert.strictEqual(failAfterReset2.headers.get('retry-after'), null);
  });

  test('AC-5: Email yang belum terdaftar tetap terkena limit 3x untuk mencegah user enumeration', async () => {
    const client = new ApiClient();
    const nonExistentEmail = `unregistered-ghost-${randomString()}@example.com`;

    // Attempt 1: 401
    const res1 = await client.post('/auth/login', { email: nonExistentEmail, password: 'WrongPassword1!' });
    assert.strictEqual(res1.status, 401);
    assert.strictEqual(res1.body.message, 'Email atau password salah');

    // Attempt 2: 401
    const res2 = await client.post('/auth/login', { email: nonExistentEmail, password: 'WrongPassword2!' });
    assert.strictEqual(res2.status, 401);
    assert.strictEqual(res2.body.message, 'Email atau password salah');

    // Attempt 3: 429 Too Many Requests
    const res3 = await client.post('/auth/login', { email: nonExistentEmail, password: 'WrongPassword3!' });
    assert.strictEqual(res3.status, 429, 'Unregistered email must also be throttled on 3rd failure');
    assert.strictEqual(res3.headers.get('retry-after'), '180');
    assert.strictEqual(res3.body.retryAfter, 180);

    // Attempt 4: 429 Too Many Requests
    const res4 = await client.post('/auth/login', { email: nonExistentEmail, password: 'WrongPassword4!' });
    assert.strictEqual(res4.status, 429);
    assert.ok(Number(res4.headers.get('retry-after')) > 0);
  });

  test('Normalisasi Email: Variasi huruf besar-kecil dan spasi menggunakan throttle counter yang sama', async () => {
    const client = new ApiClient();
    const baseEmail = `normalize-${randomString()}@example.com`;

    // Attempt 1: UPPERCASE with whitespace
    const res1 = await client.post('/auth/login', {
      email: `   ${baseEmail.toUpperCase()}   `,
      password: 'WrongPassword1!',
    });
    assert.strictEqual(res1.status, 401);

    // Attempt 2: Mixed Case
    const half = Math.floor(baseEmail.length / 2);
    const mixed = baseEmail.slice(0, half).toUpperCase() + baseEmail.slice(half).toLowerCase();
    const res2 = await client.post('/auth/login', {
      email: `  ${mixed} `,
      password: 'WrongPassword2!',
    });
    assert.strictEqual(res2.status, 401);

    // Attempt 3: Exact lowercase -> Must trigger 3rd failure lockout (429)
    const res3 = await client.post('/auth/login', {
      email: baseEmail.toLowerCase(),
      password: 'WrongPassword3!',
    });
    assert.strictEqual(
      res3.status,
      429,
      `Expected 429 when normalized email hits 3rd failure, got ${res3.status}`
    );
    assert.strictEqual(res3.headers.get('retry-after'), '180');
  });

  test('Proteksi Lockout: Password yang valid tetap ditolak 429 saat akun dalam masa lockout', async () => {
    const client = new ApiClient();
    const uniqueEmail = `qa-lockout-validpass-${randomString()}@example.com`;
    const validPassword = 'CorrectPassword123!';

    // Register user
    const regRes = await client.post('/auth/register', {
      email: uniqueEmail,
      password: validPassword,
      fullName: 'QA Lockout Test User',
    });
    assert.strictEqual(regRes.status, 201);

    // Trigger 3 failures
    for (let i = 1; i <= 3; i++) {
      await client.post('/auth/login', { email: uniqueEmail, password: `WrongPassword${i}!` });
    }

    // Now attempt login with VALID credentials while account is locked
    const lockedValidAttempt = await client.post('/auth/login', {
      email: uniqueEmail,
      password: validPassword,
    });

    assert.strictEqual(
      lockedValidAttempt.status,
      429,
      'Even valid password must be rejected with 429 when lockout is active'
    );
    assert.strictEqual(lockedValidAttempt.body.statusCode, 429);
    assert.ok(Number(lockedValidAttempt.headers.get('retry-after')) > 0);
  });
});
