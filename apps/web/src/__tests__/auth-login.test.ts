import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Auth Login Defensive Error Handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function simulateLogin(
    credentials: { email: string; password: string },
    applyAccessToken: (token: string | null) => void = () => {},
    setUser: (user: any) => void = () => {}
  ) {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'same-origin',
      });
    } catch {
      throw new Error(
        'Tidak dapat terhubung ke server RumahKita. Pastikan koneksi dan layanan server aktif.'
      );
    }

    const envelope = await res.json().catch(() => null);
    if (!res.ok || !envelope?.success) {
      const retryAfterHeader = res.headers.get('retry-after');
      let retryAfter: number | undefined;
      if (typeof envelope?.retryAfter === 'number') {
        retryAfter = envelope.retryAfter;
      } else if (retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))) {
        retryAfter = Number(retryAfterHeader);
      }

      const defaultMsg =
        res.status === 429
          ? 'Terlalu banyak percobaan login gagal. Akun sementara dikunci demi keamanan.'
          : res.status === 502
            ? 'Tidak dapat terhubung ke server RumahKita. Pastikan koneksi dan layanan server aktif.'
            : 'Login gagal. Periksa kembali email dan kata sandi Anda.';

      const errorMessage = envelope?.message || defaultMsg;
      const err = new Error(errorMessage);
      (err as any).status = res.status;
      if (res.status === 429 || retryAfter !== undefined) {
        (err as any).retryAfter =
          retryAfter !== undefined && !Number.isNaN(retryAfter)
            ? retryAfter
            : 180;
      }
      throw err;
    }

    const { accessToken: token, user: userData } = envelope.data;
    applyAccessToken(token);
    setUser(userData);
    return { token, userData };
  }

  it('handles low-level network failure (TypeError / connection refused) with human-readable error', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await assert.rejects(
      async () => {
        await simulateLogin({ email: 'test@rumahkita.local', password: 'Password123!' });
      },
      {
        name: 'Error',
        message: 'Tidak dapat terhubung ke server RumahKita. Pastikan koneksi dan layanan server aktif.',
      }
    );
  });

  it('handles 502 Bad Gateway with informative error message', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 502,
          error: 'Bad Gateway',
          message: 'Tidak dapat terhubung ke server backend RumahKita',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await simulateLogin({ email: 'test@rumahkita.local', password: 'Password123!' });
      },
      {
        name: 'Error',
        message: 'Tidak dapat terhubung ke server backend RumahKita',
      }
    );
  });

  it('handles 502 Bad Gateway when body is not valid JSON with fallback error message', async () => {
    globalThis.fetch = async () => {
      return new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      });
    };

    await assert.rejects(
      async () => {
        await simulateLogin({ email: 'test@rumahkita.local', password: 'Password123!' });
      },
      {
        name: 'Error',
        message: 'Tidak dapat terhubung ke server RumahKita. Pastikan koneksi dan layanan server aktif.',
      }
    );
  });

  it('handles 401 invalid credentials with backend message', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 401,
          message: 'Email atau kata sandi tidak sesuai.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await simulateLogin({ email: 'test@rumahkita.local', password: 'WrongPassword' });
      },
      {
        name: 'Error',
        message: 'Email atau kata sandi tidak sesuai.',
      }
    );
  });

  it('handles 429 Too Many Requests with retryAfter from body and header', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 180 detik.',
          retryAfter: 180,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '180',
          },
        }
      );
    };

    try {
      await simulateLogin({ email: 'test@rumahkita.local', password: 'WrongPassword' });
      assert.fail('Should have thrown an error');
    } catch (err: any) {
      assert.equal(err.message, 'Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 180 detik.');
      assert.equal(err.status, 429);
      assert.equal(err.retryAfter, 180);
    }
  });

  it('handles 429 Too Many Requests with fallback retryAfter when body retryAfter is missing', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          statusCode: 429,
          error: 'Too Many Requests',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    try {
      await simulateLogin({ email: 'test@rumahkita.local', password: 'WrongPassword' });
      assert.fail('Should have thrown an error');
    } catch (err: any) {
      assert.equal(err.message, 'Terlalu banyak percobaan login gagal. Akun sementara dikunci demi keamanan.');
      assert.equal(err.status, 429);
      assert.equal(err.retryAfter, 180);
    }
  });

  it('successfully logs in and receives token and user info', async () => {
    const mockUser = {
      id: 'usr-1',
      name: 'Budi Santoso',
      email: 'budi@rumahkita.local',
    };

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            accessToken: 'token-abc',
            user: mockUser,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    let savedToken: string | null = null;
    let savedUser: any = null;

    const result = await simulateLogin(
      { email: 'budi@rumahkita.local', password: 'Password123!' },
      (token) => {
        savedToken = token;
      },
      (user) => {
        savedUser = user;
      }
    );

    assert.equal(result.token, 'token-abc');
    assert.deepEqual(result.userData, mockUser);
    assert.equal(savedToken, 'token-abc');
    assert.deepEqual(savedUser, mockUser);
  });
});
