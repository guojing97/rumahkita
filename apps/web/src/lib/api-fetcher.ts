import { ApiClientError } from './api-client.ts';

export interface FetchOptions extends RequestInit {
  householdId?: string;
  withMeta?: boolean;
}

let currentAccessToken: string | null = null;
let activeHouseholdId: string | null = null;

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export function setApiAuthToken(token: string | null) {
  currentAccessToken = token;
}

export function getApiAuthToken(): string | null {
  return currentAccessToken;
}

export function setApiHouseholdId(householdId: string | null) {
  activeHouseholdId = householdId;
}

export function getApiHouseholdId(): string | null {
  return activeHouseholdId;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const url = endpoint.startsWith('/') ? `/api${endpoint}` : `/api/${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (currentAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  const hId = options.householdId || activeHouseholdId;
  if (hId && !headers.has('X-Household-Id')) {
    headers.set('X-Household-Id', hId);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Sends HttpOnly refreshToken cookie
  });

  // Handle Token Expiry (401)
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
        });

        if (!refreshRes.ok) {
          throw new Error('Refresh token expired');
        }

        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData.data?.accessToken;
        setApiAuthToken(newAccessToken);

        // Resume queued calls
        refreshQueue.forEach((cb) => cb(newAccessToken));
        refreshQueue = [];
        isRefreshing = false;

        // Retry original request
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        return apiFetch<T>(endpoint, { ...options, headers });
      } catch (refreshErr) {
        isRefreshing = false;
        refreshQueue = [];
        setApiAuthToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
        throw refreshErr;
      }
    } else {
      // Queue until active refresh completes
      return new Promise<T>((resolve) => {
        refreshQueue.push((newToken: string) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          resolve(apiFetch<T>(endpoint, { ...options, headers }));
        });
      });
    }
  }

  // Handle CSV stream
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return (await response.text()) as unknown as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiClientError(
      data || {
        success: false,
        statusCode: response.status,
        error: response.statusText,
        message: 'Terjadi kesalahan komunikasi dengan server',
      }
    );
  }

  // Return un-enveloped data if enveloped, preserving envelope if meta is present or requested
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    if ('meta' in data || options.withMeta) {
      return data as T;
    }
    return data.data as T;
  }

  return data as T;
}
