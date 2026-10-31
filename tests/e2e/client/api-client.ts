/**
 * Opaque-Box HTTP API Client for E2E Tests
 * Pure native fetch implementation with CookieJar and Bearer Token support.
 */

import { CONFIG } from '../config.ts';

export interface RequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
}

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  headers: Headers;
  body: T;
  rawText: string;
}

export class CookieJar {
  private cookies = new Map<string, string>();

  public setFromHeaders(headers: Headers): void {
    // In Node 20+, headers.getSetCookie returns an array of Set-Cookie strings
    const setCookieHeaders = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);

    for (const cookieStr of setCookieHeaders) {
      const parts = cookieStr.split(';')[0]?.trim();
      if (!parts) continue;
      const eqIdx = parts.indexOf('=');
      if (eqIdx !== -1) {
        const key = parts.slice(0, eqIdx).trim();
        const val = parts.slice(eqIdx + 1).trim();
        this.cookies.set(key, val);
      }
    }
  }

  public getCookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  public clear(): void {
    this.cookies.clear();
  }

  public getCookieHeader(): string {
    const pairs: string[] = [];
    for (const [key, value] of this.cookies.entries()) {
      pairs.push(`${key}=${value}`);
    }
    return pairs.join('; ');
  }
}

export class ApiClient {
  public readonly baseUrl: string;
  public readonly cookieJar: CookieJar;
  private bearerToken: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || CONFIG.API_BASE_URL;
    this.cookieJar = new CookieJar();
  }

  public setBearerToken(token: string | null): void {
    this.bearerToken = token;
  }

  public getBearerToken(): string | null {
    return this.bearerToken;
  }

  public async get<T = any>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  public async post<T = any>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  public async put<T = any>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  public async delete<T = any>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  public async request<T = any>(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(this.baseUrl.replace(/\/+$/, '') + cleanPath);

    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      ...(options.headers || {}),
    };

    if (this.bearerToken && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    const cookieHeader = this.cookieJar.getCookieHeader();
    if (cookieHeader && !headers['Cookie'] && !headers['cookie']) {
      headers['Cookie'] = cookieHeader;
    }

    let payload: string | undefined = undefined;
    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        payload = options.body;
      } else {
        payload = JSON.stringify(options.body);
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });

      this.cookieJar.setFromHeaders(response.headers);

      const rawText = await response.text();
      let parsedBody: any = rawText;

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = rawText;
        }
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        body: parsedBody as T,
        rawText,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
