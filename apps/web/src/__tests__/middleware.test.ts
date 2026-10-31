import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { middleware } from '../middleware.ts';

function createMockNextRequest(urlStr: string, cookies: Record<string, string> = {}) {
  const url = new URL(urlStr);
  return {
    url: urlStr,
    nextUrl: url,
    cookies: {
      has: (name: string) => Object.prototype.hasOwnProperty.call(cookies, name),
      get: (name: string) =>
        Object.prototype.hasOwnProperty.call(cookies, name) ? { value: cookies[name] } : undefined,
    },
    headers: new Headers(),
  } as any;
}

describe('Middleware Access Control & Normalization', () => {
  it('redirects unauthenticated users accessing root "/" to "/login"', () => {
    const req = createMockNextRequest('http://localhost:3000/');
    const res = middleware(req);

    assert.ok(res.status === 307 || res.status === 302, 'Should be a redirect response');
    const location = res.headers.get('location');
    assert.ok(location, 'Should have Location header');
    const redirectUrl = new URL(location!);
    assert.equal(redirectUrl.pathname, '/login');
    assert.equal(
      redirectUrl.searchParams.get('redirect'),
      null,
      'Root path should not include redirect search param'
    );
  });

  it('redirects authenticated users accessing root "/" to "/dashboard"', () => {
    const req = createMockNextRequest('http://localhost:3000/', { refreshToken: 'valid-token' });
    const res = middleware(req);

    assert.ok(res.status === 307 || res.status === 302, 'Should be a redirect response');
    const location = res.headers.get('location');
    assert.ok(location, 'Should have Location header');
    const redirectUrl = new URL(location!);
    assert.equal(redirectUrl.pathname, '/dashboard');
  });

  it('redirects authenticated users with refresh_token cookie on root "/" to "/dashboard"', () => {
    const req = createMockNextRequest('http://localhost:3000/', { refresh_token: 'valid-token' });
    const res = middleware(req);

    assert.ok(res.status === 307 || res.status === 302, 'Should be a redirect response');
    const location = res.headers.get('location');
    assert.ok(location, 'Should have Location header');
    const redirectUrl = new URL(location!);
    assert.equal(redirectUrl.pathname, '/dashboard');
  });

  it('allows unauthenticated access to "/login"', () => {
    const req = createMockNextRequest('http://localhost:3000/login');
    const res = middleware(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  it('normalizes trailing slash so "/login/" is treated as public route "/login"', () => {
    const req = createMockNextRequest('http://localhost:3000/login/');
    const res = middleware(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  it('does NOT speculatively redirect authenticated users on "/login" (prevents ERR_TOO_MANY_REDIRECTS loop)', () => {
    const req = createMockNextRequest('http://localhost:3000/login', { refreshToken: 'stale-or-valid-token' });
    const res = middleware(req);

    // Speculative redirect was removed so Edge Middleware will not loop with expired cookies
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  it('does NOT speculatively redirect authenticated users on "/login/" with trailing slash', () => {
    const req = createMockNextRequest('http://localhost:3000/login/', { refresh_token: 'stale-token' });
    const res = middleware(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  it('redirects unauthenticated users accessing protected "/dashboard" to "/login?redirect=/dashboard"', () => {
    const req = createMockNextRequest('http://localhost:3000/dashboard');
    const res = middleware(req);

    assert.ok(res.status === 307 || res.status === 302, 'Should be a redirect response');
    const location = res.headers.get('location');
    assert.ok(location, 'Should have Location header');
    const redirectUrl = new URL(location!);
    assert.equal(redirectUrl.pathname, '/login');
    assert.equal(redirectUrl.searchParams.get('redirect'), '/dashboard');
  });

  it('redirects unauthenticated users accessing protected "/dashboard/" (with trailing slash) with normalized redirect target', () => {
    const req = createMockNextRequest('http://localhost:3000/dashboard/');
    const res = middleware(req);

    assert.ok(res.status === 307 || res.status === 302);
    const location = res.headers.get('location');
    const redirectUrl = new URL(location!);
    assert.equal(redirectUrl.pathname, '/login');
    assert.equal(redirectUrl.searchParams.get('redirect'), '/dashboard');
  });

  it('redirects unauthenticated users accessing protected "/inventori" to "/login?redirect=/inventori"', () => {
    const req = createMockNextRequest('http://localhost:3000/inventori');
    const res = middleware(req);

    assert.ok(res.status === 307 || res.status === 302);
    const location = res.headers.get('location');
    const redirectUrl = new URL(location!);
    assert.equal(redirectUrl.pathname, '/login');
    assert.equal(redirectUrl.searchParams.get('redirect'), '/inventori');
  });

  it('allows access to protected route when refreshToken cookie is present', () => {
    const req = createMockNextRequest('http://localhost:3000/dashboard', { refreshToken: 'active-token' });
    const res = middleware(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
  });

  it('allows public access to api routes, static assets, and password reset', () => {
    const routes = ['/api/auth/login', '/_next/static/test.js', '/favicon.ico', '/password/forgot'];
    for (const route of routes) {
      const req = createMockNextRequest(`http://localhost:3000${route}`);
      const res = middleware(req);
      assert.equal(res.status, 200, `Route ${route} should be allowed`);
    }
  });
});

describe('Login Safe Redirect Validation', () => {
  function getSafeRedirect(rawRedirect: string | null): string {
    const isSafeRedirect =
      rawRedirect &&
      rawRedirect.startsWith('/') &&
      !rawRedirect.startsWith('//') &&
      !rawRedirect.startsWith('/\\') &&
      !rawRedirect.startsWith('/login') &&
      rawRedirect !== '/';

    return isSafeRedirect ? rawRedirect : '/dashboard';
  }

  it('allows safe relative paths', () => {
    assert.equal(getSafeRedirect('/dashboard'), '/dashboard');
    assert.equal(getSafeRedirect('/inventori'), '/inventori');
    assert.equal(getSafeRedirect('/transaksi?filter=monthly'), '/transaksi?filter=monthly');
  });

  it('rejects root "/" and defaults to "/dashboard"', () => {
    assert.equal(getSafeRedirect('/'), '/dashboard');
  });

  it('rejects "/login" and all sub-paths or query params of login to prevent loops', () => {
    assert.equal(getSafeRedirect('/login'), '/dashboard');
    assert.equal(getSafeRedirect('/login/'), '/dashboard');
    assert.equal(getSafeRedirect('/login?redirect=/dashboard'), '/dashboard');
    assert.equal(getSafeRedirect('/login/oauth'), '/dashboard');
  });

  it('rejects protocol-relative and backslash open-redirect attempts', () => {
    assert.equal(getSafeRedirect('//evil.com'), '/dashboard');
    assert.equal(getSafeRedirect('/\\evil.com'), '/dashboard');
    assert.equal(getSafeRedirect('https://evil.com'), '/dashboard');
    assert.equal(getSafeRedirect('javascript:alert(1)'), '/dashboard');
    assert.equal(getSafeRedirect(null), '/dashboard');
    assert.equal(getSafeRedirect(''), '/dashboard');
  });
});

