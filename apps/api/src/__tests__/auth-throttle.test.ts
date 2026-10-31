import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { Response, Request } from 'express';
import { AuthService } from '../modules/auth/auth.service.js';
import { LoginThrottleService } from '../modules/auth/login-throttle.service.js';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
import { DbClient } from '@rumahkita/db';

function createMockResponse() {
  const headers = new Map<string, string>();
  const cookies = new Map<string, any>();

  const res = {
    headers,
    cookies,
    statusCode: 200,
    jsonBody: null as any,
    setHeader: (name: string, value: string) => {
      headers.set(name.toLowerCase(), String(value));
      return res;
    },
    set: (name: string, value: string) => {
      headers.set(name.toLowerCase(), String(value));
      return res;
    },
    getHeader: (name: string) => {
      return headers.get(name.toLowerCase());
    },
    cookie: (name: string, value: any, _options: any) => {
      cookies.set(name, { value, options: _options });
      return res;
    },
    clearCookie: (name: string, _options: any) => {
      cookies.delete(name);
      return res;
    },
    status: (code: number) => {
      res.statusCode = code;
      return {
        json: (data: any) => {
          res.jsonBody = data;
          return data;
        },
      };
    },
  };

  return res as unknown as Response & {
    headers: Map<string, string>;
    cookies: Map<string, any>;
    statusCode: number;
    jsonBody: any;
  };
}

function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers,
    ip: '127.0.0.1',
    url: '/api/v1/auth/login',
  } as unknown as Request;
}

function createMockJwtService() {
  return {
    sign: (_payload: any) => 'mock_access_token_jwt',
  } as any;
}

describe('Auth Login Throttle Tests', () => {
  let throttleService: LoginThrottleService;

  beforeEach(() => {
    throttleService = new LoginThrottleService();
  });

  describe('1. LoginThrottleService Unit Tests', () => {
    it('returns isLocked=false for new identifier', () => {
      const status = throttleService.checkThrottle('user@example.com');
      assert.equal(status.isLocked, false);
      assert.equal(status.remainingSeconds, 0);
    });

    it('records failures correctly and locks after 3 attempts', () => {
      const email = 'target@example.com';

      // Attempt 1
      const res1 = throttleService.recordFailure(email);
      assert.equal(res1.attempts, 1);
      assert.equal(res1.isLocked, false);
      assert.equal(res1.remainingSeconds, 0);

      // Attempt 2
      const res2 = throttleService.recordFailure(email);
      assert.equal(res2.attempts, 2);
      assert.equal(res2.isLocked, false);
      assert.equal(res2.remainingSeconds, 0);

      // Attempt 3 -> Locked for 180s (3 minutes)
      const res3 = throttleService.recordFailure(email);
      assert.equal(res3.attempts, 3);
      assert.equal(res3.isLocked, true);
      assert.equal(res3.remainingSeconds, 180);

      // Subsequent check confirms locked status
      const status = throttleService.checkThrottle(email);
      assert.equal(status.isLocked, true);
      assert.ok(status.remainingSeconds > 0 && status.remainingSeconds <= 180);
    });

    it('resets attempts after successful reset() call', () => {
      const email = 'reset@example.com';
      throttleService.recordFailure(email);
      throttleService.recordFailure(email);

      assert.equal(throttleService.getEntry(email)?.attempts, 2);

      throttleService.reset(email);
      assert.equal(throttleService.getEntry(email), undefined);

      const status = throttleService.checkThrottle(email);
      assert.equal(status.isLocked, false);
      assert.equal(status.remainingSeconds, 0);
    });

    it('unlocks and resets attempts when lockout duration has passed', () => {
      const email = 'lockout-pass@example.com';
      throttleService.recordFailure(email);
      throttleService.recordFailure(email);
      throttleService.recordFailure(email);

      const entry = throttleService.getEntry(email);
      assert.ok(entry);
      // Simulate lockout expiration: lockedUntil in the past
      entry.lockedUntil = Date.now() - 1000;

      const status = throttleService.checkThrottle(email);
      assert.equal(status.isLocked, false);
      assert.equal(status.remainingSeconds, 0);
      assert.equal(entry.attempts, 0);
      assert.equal(entry.lockedUntil, null);
    });

    it('cleans up inactive entries older than 5 minutes', () => {
      const oldEmail = 'old@example.com';
      const recentEmail = 'recent@example.com';

      throttleService.recordFailure(oldEmail);
      throttleService.recordFailure(recentEmail);

      const oldEntry = throttleService.getEntry(oldEmail);
      assert.ok(oldEntry);
      // Set lastAttemptAt to 6 minutes ago
      oldEntry.lastAttemptAt = Date.now() - 6 * 60 * 1000;

      throttleService.cleanupOldEntries();

      assert.equal(throttleService.getEntry(oldEmail), undefined);
      assert.ok(throttleService.getEntry(recentEmail) !== undefined);
    });

    it('evicts the oldest entry when MAX_TRACKED_IDENTIFIERS capacity is reached', () => {
      const map = (throttleService as any).attempts as Map<string, any>;

      // Populate up to MAX_TRACKED_IDENTIFIERS - 1
      for (let i = 0; i < LoginThrottleService.MAX_TRACKED_IDENTIFIERS - 1; i++) {
        map.set(`user${i}@example.com`, {
          attempts: 1,
          lockedUntil: null,
          lastAttemptAt: Date.now() - 1000,
        });
      }

      // Add one more to reach exact MAX_TRACKED_IDENTIFIERS
      throttleService.recordFailure('limit_edge@example.com');
      assert.equal(map.size, LoginThrottleService.MAX_TRACKED_IDENTIFIERS);

      // Verify first key is user0@example.com
      const oldestKey = map.keys().next().value;
      assert.equal(oldestKey, 'user0@example.com');

      // Now add another one, exceeding MAX_TRACKED_IDENTIFIERS
      throttleService.recordFailure('overflow@example.com');

      // user0@example.com must have been evicted, and size remains MAX_TRACKED_IDENTIFIERS
      assert.equal(map.size, LoginThrottleService.MAX_TRACKED_IDENTIFIERS);
      assert.equal(map.has('user0@example.com'), false);
      assert.equal(map.has('overflow@example.com'), true);
    });

    it('normalizes identifier strings (trim and lowercase) directly within the service', () => {
      throttleService.recordFailure('  User.NAME@Example.COM  ');
      assert.equal(throttleService.getEntry('user.name@example.com')?.attempts, 1);

      const status = throttleService.checkThrottle('USER.NAME@EXAMPLE.COM ');
      assert.equal(status.isLocked, false);

      throttleService.recordFailure('user.name@example.com');
      throttleService.recordFailure('  user.name@example.com');

      const lockedStatus = throttleService.checkThrottle('  User.Name@example.com ');
      assert.equal(lockedStatus.isLocked, true);
      assert.ok(lockedStatus.remainingSeconds > 0 && lockedStatus.remainingSeconds <= 180);

      throttleService.reset('  USER.NAME@EXAMPLE.COM ');
      assert.equal(throttleService.getEntry('user.name@example.com'), undefined);
    });
  });

  describe('2. AuthService Login Integration & Throttle Behavior', () => {
    let validPasswordHash: string;
    const testEmail = 'kevin@example.com';
    const correctPassword = 'correct_password_123';
    const wrongPassword = 'wrong_password_999';

    const mockUser = {
      id: 'usr-123',
      email: testEmail,
      passwordHash: '',
      fullName: 'Kevin Hendrawan',
      isActive: true,
    };

    beforeEach(async () => {
      validPasswordHash = await hash(correctPassword, {
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      mockUser.passwordHash = validPasswordHash;
    });

    function setupAuthService(findUserResult: any[] = [mockUser]) {
      const mockDb = {
        select: (_fields?: any) => ({
          from: (_table: any) => ({
            where: (_cond: any) => Promise.resolve(findUserResult),
            innerJoin: () => ({
              where: () =>
                Promise.resolve([
                  {
                    id: 'hh-1',
                    name: 'Keluarga Kevin',
                    role: 'owner',
                  },
                ]),
            }),
          }),
        }),
        insert: () => ({
          values: () => Promise.resolve([]),
        }),
      } as unknown as DbClient;

      const jwtService = createMockJwtService();
      const authService = new AuthService(mockDb, jwtService, throttleService);
      return { authService, mockDb };
    }

    it('fails with 401 Unauthorized for 1st and 2nd incorrect password attempts', async () => {
      const { authService } = setupAuthService([mockUser]);
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      const req = createMockRequest();

      // 1st failed attempt -> 401
      await assert.rejects(
        async () => {
          await authService.login(
            { email: testEmail, password: wrongPassword },
            res1,
            req
          );
        },
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.getStatus(), 401);
          assert.equal(err.message, 'Email atau password salah');
          return true;
        }
      );
      assert.equal(res1.getHeader('retry-after'), undefined);

      // 2nd failed attempt -> 401
      await assert.rejects(
        async () => {
          await authService.login(
            { email: testEmail, password: wrongPassword },
            res2,
            req
          );
        },
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.getStatus(), 401);
          assert.equal(err.message, 'Email atau password salah');
          return true;
        }
      );
      assert.equal(res2.getHeader('retry-after'), undefined);
    });

    it('locks account on 3rd failure with 429 Too Many Requests and Retry-After: 180', async () => {
      const { authService } = setupAuthService([mockUser]);
      const req = createMockRequest();

      // Attempt 1 & 2
      await assert.rejects(
        () => authService.login({ email: testEmail, password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );
      await assert.rejects(
        () => authService.login({ email: testEmail, password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );

      // Attempt 3 -> 429 Too Many Requests
      const res3 = createMockResponse();
      await assert.rejects(
        async () => {
          await authService.login(
            { email: testEmail, password: wrongPassword },
            res3,
            req
          );
        },
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.equal(err.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
          const responseObj = err.getResponse() as any;
          assert.equal(responseObj.statusCode, 429);
          assert.equal(responseObj.retryAfter, 180);
          assert.match(
            responseObj.message,
            /Terlalu banyak percobaan login gagal.*180 detik/
          );
          return true;
        }
      );

      // Header Retry-After must be set to 180
      assert.equal(res3.getHeader('retry-after'), '180');
    });

    it('rejects subsequent requests immediately with 429 when locked', async () => {
      const { authService } = setupAuthService([mockUser]);
      const req = createMockRequest();

      // Trigger 3 failures
      for (let i = 0; i < 3; i++) {
        await assert.rejects(
          () => authService.login({ email: testEmail, password: wrongPassword }, createMockResponse(), req)
        );
      }

      // 4th attempt with CORRECT password while locked -> Immediately rejected with 429
      const res4 = createMockResponse();
      await assert.rejects(
        async () => {
          await authService.login(
            { email: testEmail, password: correctPassword },
            res4,
            req
          );
        },
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.equal(err.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
          return true;
        }
      );

      assert.ok(res4.getHeader('retry-after') !== undefined);
      const retryAfterVal = Number(res4.getHeader('retry-after'));
      assert.ok(retryAfterVal > 0 && retryAfterVal <= 180);
    });

    it('resets failure counter upon successful login', async () => {
      const { authService } = setupAuthService([mockUser]);
      const req = createMockRequest();

      // Fail 2 times
      await assert.rejects(
        () => authService.login({ email: testEmail, password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );
      await assert.rejects(
        () => authService.login({ email: testEmail, password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );

      assert.equal(throttleService.getEntry(testEmail)?.attempts, 2);

      // 3rd attempt is successful
      const resSuccess = createMockResponse();
      const result = await authService.login(
        { email: testEmail, password: correctPassword },
        resSuccess,
        req
      );

      assert.ok(result.accessToken);
      assert.equal(result.user.email, testEmail);

      // Throttle must be reset
      assert.equal(throttleService.getEntry(testEmail), undefined);
      const throttleStatus = throttleService.checkThrottle(testEmail);
      assert.equal(throttleStatus.isLocked, false);
      assert.equal(throttleStatus.remainingSeconds, 0);
    });

    it('applies throttling to non-existent email to prevent user enumeration', async () => {
      const nonExistentEmail = 'ghost@example.com';
      // setup AuthService with empty user search result
      const { authService } = setupAuthService([]);
      const req = createMockRequest();

      // Attempt 1 -> 401
      await assert.rejects(
        () => authService.login({ email: nonExistentEmail, password: 'any' }, createMockResponse(), req),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.getStatus(), 401);
          assert.equal(err.message, 'Email atau password salah');
          return true;
        }
      );

      // Attempt 2 -> 401
      await assert.rejects(
        () => authService.login({ email: nonExistentEmail, password: 'any' }, createMockResponse(), req),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.getStatus(), 401);
          return true;
        }
      );

      // Attempt 3 -> 429
      const res3 = createMockResponse();
      await assert.rejects(
        async () => {
          await authService.login(
            { email: nonExistentEmail, password: 'any' },
            res3,
            req
          );
        },
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.equal(err.getStatus(), HttpStatus.TOO_MANY_REQUESTS);
          return true;
        }
      );

      assert.equal(res3.getHeader('retry-after'), '180');
    });

    it('normalizes email (trim & lowercase) so variations share the same throttle limit', async () => {
      const { authService } = setupAuthService([mockUser]);
      const req = createMockRequest();

      // 1: uppercase with whitespace
      await assert.rejects(
        () => authService.login({ email: '  KEVIN@example.com  ', password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );

      // 2: mixed case
      await assert.rejects(
        () => authService.login({ email: 'Kevin@Example.COM', password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );

      // 3: lowercase -> should hit 3rd failure lockout
      const res3 = createMockResponse();
      await assert.rejects(
        () => authService.login({ email: 'kevin@example.com', password: wrongPassword }, res3, req),
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.equal(err.getStatus(), 429);
          return true;
        }
      );

      assert.equal(res3.getHeader('retry-after'), '180');
    });

    it('verifies password before inactive status check to prevent enumeration and throttle bypass', async () => {
      const inactiveUser = {
        ...mockUser,
        id: 'usr-inactive',
        email: 'inactive@example.com',
        isActive: false,
      };
      const { authService } = setupAuthService([inactiveUser]);
      const req = createMockRequest();

      // 1. Inactive account with WRONG password: must return generic error and increment throttle
      await assert.rejects(
        () => authService.login({ email: inactiveUser.email, password: wrongPassword }, createMockResponse(), req),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.message, 'Email atau password salah');
          return true;
        }
      );
      assert.equal(throttleService.getEntry(inactiveUser.email)?.attempts, 1);

      // 2. Second wrong password
      await assert.rejects(
        () => authService.login({ email: inactiveUser.email, password: wrongPassword }, createMockResponse(), req),
        UnauthorizedException
      );
      assert.equal(throttleService.getEntry(inactiveUser.email)?.attempts, 2);

      // 3. Third wrong password -> Locked 429
      const res3 = createMockResponse();
      await assert.rejects(
        () => authService.login({ email: inactiveUser.email, password: wrongPassword }, res3, req),
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.equal(err.getStatus(), 429);
          return true;
        }
      );
      assert.equal(res3.getHeader('retry-after'), '180');

      // Clear throttle to test correct password
      throttleService.reset(inactiveUser.email);

      // 4. Inactive account with CORRECT password -> returns 'Akun tidak aktif atau dinonaktifkan'
      await assert.rejects(
        () => authService.login({ email: inactiveUser.email, password: correctPassword }, createMockResponse(), req),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.equal(err.message, 'Akun tidak aktif atau dinonaktifkan');
          return true;
        }
      );
    });
  });

  describe('3. HttpExceptionFilter Response Formatting for 429', () => {
    it('properly formats 429 response and ensures Retry-After header & payload field', () => {
      const filter = new HttpExceptionFilter();
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      const host = {
        switchToHttp: () => ({
          getResponse: () => mockRes,
          getRequest: () => mockReq,
        }),
      } as any;

      const exception = new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 180 detik.',
          retryAfter: 180,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );

      filter.catch(exception, host);

      assert.equal(mockRes.statusCode, 429);
      assert.equal(mockRes.getHeader('retry-after'), '180');
      assert.ok(mockRes.jsonBody);
      assert.equal(mockRes.jsonBody.success, false);
      assert.equal(mockRes.jsonBody.statusCode, 429);
      assert.equal(mockRes.jsonBody.error, 'Too Many Requests');
      assert.equal(mockRes.jsonBody.retryAfter, 180);
      assert.match(mockRes.jsonBody.message, /180 detik/);
    });
  });
});
