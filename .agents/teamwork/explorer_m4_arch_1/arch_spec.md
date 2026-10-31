# Milestone 4 Architecture Specification: Next.js App Router Frontend Web

**Document**: `arch_spec.md`  
**Milestone**: Milestone 4 (Frontend Web with Next.js App Router)  
**Author**: `explorer_m4_arch_1`  
**Date**: 2026-10-27  
**Status**: APPROVED ARCHITECTURAL SPECIFICATION  
**Target Monorepo Location**: `apps/web` (Next.js 14+ App Router)  

---

## Table of Contents
1. [Executive Summary & Architectural Goals](#1-executive-summary--architectural-goals)
2. [BFF Proxy Architecture (Next.js Route Handlers)](#2-bff-proxy-architecture-nextjs-route-handlers)
   - 2.1 Route Handler Catch-All Pattern (`/api/[...path]/route.ts`)
   - 2.2 Security & Token Lifecycle (JWT Access Token & HttpOnly Refresh Cookie)
   - 2.3 Header Forwarding & Multi-Tenant `X-Household-Id`
   - 2.4 Streaming & CSV Export Proxying
   - 2.5 Standard Backend Error Envelope & Typed Client API Wrapper
   - 2.6 Automatic 401 Silent Token Refresh & Request Queueing
3. [Layout & Responsive Navigation Architecture (390px – 1280px)](#3-layout--responsive-navigation-architecture-390px--1280px)
   - 3.1 Design System Tokens & Global CSS (Neo-Brutalism)
   - 3.2 Typography & Font Optimization (Space Grotesk & Inter)
   - 3.3 Breakpoints & Layout Container Matrix
   - 3.4 Desktop Layout Architecture (>= 1024px)
   - 3.5 Mobile Layout Architecture (< 1024px, 390px Base)
   - 3.6 Antislop Rules for Mobile & Desktop Layouts
4. [Auth & Household Context Architecture](#4-auth--household-context-architecture)
   - 4.1 State Models & Interfaces
   - 4.2 `AuthProvider` & In-Memory Token Management
   - 4.3 `HouseholdProvider` & Multi-Tenant Context Switching
   - 4.4 Login Page Architecture (`/login`)
   - 4.5 Route Protection (Next.js Edge Middleware & Client Hydration Guard)
5. [Directory Layout & File Organization](#5-directory-layout--file-organization)
6. [Implementation Roadmap & Verification Protocol](#6-implementation-roadmap--verification-protocol)

---

## 1. Executive Summary & Architectural Goals

RumahKita is a private household finance & inventory application built for two household members. Milestone 4 builds the full frontend web application in `apps/web` using **Next.js 14+ App Router** and **React 18**, styled with an authentic **Neo-Brutalism** design system (warm paper background `#FFFDF7`, 2px solid `#171717` ink outlines, hard unblurred `4px 4px 0` shadows, and high-contrast neon lime `#C8F169` accents).

### Architectural Core Decisions
1. **Backend-for-Frontend (BFF) Proxy**:
   The browser never communicates directly with the NestJS API port (`http://127.0.0.1:4000/api/v1`). Instead, the Next.js App Router hosts a unified wildcard route handler at `/api/[...path]/route.ts`. This proxies client calls to NestJS, manages secure HttpOnly `refreshToken` cookies, forwards Bearer JWT tokens and `X-Household-Id` headers, and intercepts 401 errors for transparent background token refresh.
2. **Strict Mobile-First & Distinct Responsive Layouts**:
   Instead of squeezing a desktop layout onto a mobile screen, the UI establishes two distinct operational modes:
   - **Desktop (>= 1024px)**: 240px fixed left sidebar with active neon lime navigation pills, persistent household switcher, and user badge.
   - **Mobile (< 1024px, 390px base)**: 56px sticky top bar + 64px fixed 5-item bottom navigation bar (Dashboard, Transaksi, Belanja, Inventori, Lainnya). The main scrollable content area explicitly reserves `pb-24` (96px) so content and actions are never hidden behind the navigation chrome.
3. **Robust Auth & Household State**:
   Access tokens (15-min lifetime) remain strictly in memory inside React `AuthContext` to prevent XSS exfiltration. Refresh tokens (7-day lifetime) remain in HttpOnly, SameSite=Lax cookies handled by the BFF. The active household ID is tracked in `HouseholdContext` and synchronized with `localStorage` for continuity across page reloads.

---

## 2. BFF Proxy Architecture (Next.js Route Handlers)

### 2.1 Route Handler Catch-All Pattern (`/api/[...path]/route.ts`)

A single wildcard route handler at `apps/web/src/app/api/[...path]/route.ts` proxies all client requests to the NestJS backend at `http://127.0.0.1:4000/api/v1`.

```
Browser Client                    Next.js BFF (apps/web)                NestJS API (apps/api)
(React 18 / Hooks)                 localhost:3000                        127.0.0.1:4000/api/v1
       |                                  |                                       |
       |--- 1. POST /api/auth/login ----->|                                       |
       |    { email, password }           |--- 2. POST /api/v1/auth/login ------->|
       |                                  |    { email, password }                |
       |                                  |<-- 3. HTTP 200 OK --------------------|
       |                                  |    Set-Cookie: refreshToken=...       |
       |                                  |    { accessToken, user, household }   |
       |<-- 4. HTTP 200 OK ---------------|                                       |
       |    Set-Cookie: refreshToken=...  |                                       |
       |    { accessToken, user, ... }    |                                       |
       |                                  |                                       |
       |--- 5. GET /api/dashboard ------->|                                       |
       |    Authorization: Bearer <token> |--- 6. GET /api/v1/dashboard --------->|
       |    X-Household-Id: <uuid>        |    Authorization: Bearer <token>      |
       |                                  |    X-Household-Id: <uuid>             |
       |                                  |<-- 7. HTTP 200 { data: ... } ---------|
       |<-- 8. HTTP 200 { data: ... } ----|                                       |
```

#### Route Handler Implementation
```typescript
// apps/web/src/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_BASE = process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000/api/v1';

async function handleProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const targetPath = params.path.join('/');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_API_BASE.replace(/\/+$/, '')}/${targetPath}${search}`;

  // 1. Prepare forwarded headers
  const forwardHeaders = new Headers();
  
  // Forward critical client headers
  const headersToForward = [
    'authorization',
    'x-household-id',
    'idempotency-key',
    'content-type',
    'accept',
    'user-agent',
  ];
  
  for (const headerName of headersToForward) {
    const val = req.headers.get(headerName);
    if (val) forwardHeaders.set(headerName, val);
  }

  // Forward incoming cookies (including refreshToken)
  const incomingCookie = req.headers.get('cookie');
  if (incomingCookie) {
    forwardHeaders.set('cookie', incomingCookie);
  }

  // 2. Prepare payload
  let body: ReadableStream<Uint8Array> | null = null;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = req.body;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      // @ts-expect-error duplex is required in Node 18+ when passing a stream body
      duplex: body ? 'half' : undefined,
      redirect: 'manual',
    });

    // 3. Propagate response headers
    const responseHeaders = new Headers();
    const contentType = upstreamRes.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);

    const contentDisposition = upstreamRes.headers.get('content-disposition');
    if (contentDisposition) responseHeaders.set('content-disposition', contentDisposition);

    // 4. Securely replicate Set-Cookie headers from upstream NestJS
    // Node 20+ getSetCookie() returns all Set-Cookie directives as an array
    const setCookies = typeof upstreamRes.headers.getSetCookie === 'function'
      ? upstreamRes.headers.getSetCookie()
      : (upstreamRes.headers.get('set-cookie') ? [upstreamRes.headers.get('set-cookie')!] : []);

    const res = new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });

    for (const cookieStr of setCookies) {
      res.headers.append('set-cookie', cookieStr);
    }

    return res;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Tidak dapat terhubung ke server backend RumahKita',
        timestamp: new Date().toISOString(),
        path: `/api/${targetPath}`,
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
```

### 2.2 Security & Token Lifecycle

| Token Type | Storage Location | Lifetime | Security Attributes | Purpose |
|------------|------------------|----------|---------------------|---------|
| **Access Token** | Memory (`AuthContext`) | 15 Minutes | In-Memory only, not stored in `localStorage` or `sessionStorage` | Authenticates API requests via `Authorization: Bearer <jwt>`. Resistant to XSS data exfiltration. |
| **Refresh Token** | HttpOnly Cookie (`refreshToken`) | 7 Days | `HttpOnly; SameSite=Lax; Path=/; Secure` (in prod) | Rotates on use. Revoked on reuse detection or explicit logout. |

### 2.3 Header Forwarding & Multi-Tenant `X-Household-Id`
- All business endpoints in NestJS are guarded by `HouseholdGuard` (`apps/api/src/common/guards/household.guard.ts`).
- When a user selects an active household in the UI, `HouseholdContext` supplies `activeHousehold.id`.
- The client API fetcher attaches `X-Household-Id: <uuid>` to every request header.
- The BFF proxy receives `X-Household-Id` and forwards it cleanly to NestJS.
- If a user attempts to send an `X-Household-Id` for a household they do not belong to, NestJS returns `403 Forbidden` (`"Akses ke data rumah tangga ini ditolak"`), which the BFF forwards directly to the client.

### 2.4 Streaming & CSV Export Proxying
- For transaction export: `GET /api/reports/export/csv?type=transactions&startDate=...&endDate=...`
- Upstream NestJS returns `200 OK` with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="transaksi_2026-10.csv"`.
- The BFF route handler streams `upstreamRes.body` without buffering into memory, maintaining RFC 4180 streaming fidelity.

### 2.5 Standard Backend Error Envelope & Typed Client API Wrapper

The NestJS backend outputs errors using the standardized error envelope (`apps/api/src/common/filters/http-exception.filter.ts`):
```json
{
  "success": false,
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "path": "/api/v1/incomes",
  "timestamp": "2026-10-27T18:00:00.000Z",
  "details": [
    { "field": "amount", "issue": "nominal must be greater than 0" }
  ],
  "errors": [
    { "field": "amount", "message": "nominal must be greater than 0" }
  ]
}
```

#### Typed Client Error Class & API Wrapper (`apps/web/src/lib/api-client.ts`)
```typescript
// apps/web/src/lib/api-client.ts
import { ApiErrorResponse, ApiErrorDetail } from '@rumahkita/contracts';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly errors: ApiErrorDetail[];
  public readonly details: Array<{ field?: string; issue: string }>;
  public readonly timestamp?: string;
  public readonly path?: string;

  constructor(payload: ApiErrorResponse) {
    const primaryMessage = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'Terjadi kesalahan pada sistem';
    super(primaryMessage);
    this.name = 'ApiClientError';
    this.statusCode = payload.statusCode;
    this.error = payload.error;
    this.errors = payload.errors || [];
    this.details = (payload as any).details || [];
    this.timestamp = payload.timestamp;
    this.path = payload.path;
  }

  /**
   * Helper to retrieve field-specific error message for React Hook Form integration
   */
  public getFieldError(fieldName: string): string | undefined {
    const foundError = this.errors.find((e) => e.field === fieldName);
    if (foundError) return foundError.message;
    const foundDetail = this.details.find((d) => d.field === fieldName);
    return foundDetail?.issue;
  }
}
```

### 2.6 Automatic 401 Silent Token Refresh & Request Queueing

To provide seamless UX without abrupt session drops, the client API wrapper intercepts HTTP 401 responses. If an access token expires:
1. It pauses concurrent outgoing requests in an in-memory queue.
2. It initiates a single `POST /api/auth/refresh` request.
3. If refresh succeeds:
   - Updates in-memory access token.
   - Retries all queued requests with the new token.
4. If refresh fails (e.g. refresh token expired or revoked):
   - Flushes the queue with errors.
   - Clears auth state and redirects to `/login`.

```typescript
// apps/web/src/lib/api-fetcher.ts
import { ApiClientError } from './api-client';

interface FetchOptions extends RequestInit {
  householdId?: string;
}

// In-memory token management
let currentAccessToken: string | null = null;
let activeHouseholdId: string | null = null;

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export function setApiAuthToken(token: string | null) {
  currentAccessToken = token;
}

export function setApiHouseholdId(householdId: string | null) {
  activeHouseholdId = householdId;
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
        const newAccessToken = refreshData.data.accessToken;
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

  // Return un-enveloped data if enveloped
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    return data.data as T;
  }

  return data as T;
}
```

---

## 3. Layout & Responsive Navigation Architecture (390px – 1280px)

### 3.1 Design System Tokens & Global CSS (Neo-Brutalism)

The visual design language is specified in `doc/design.md`. The tokens are already integrated into `@rumahkita/ui` and `apps/web/src/app/globals.css`.

#### Root CSS Variables & Meaning
```css
:root {
  /* Surface & Base */
  --bg: #FFFDF7;          /* Warm paper background */
  --surface: #FFFFFF;     /* Pure white for cards, modals, form panels */
  --ink: #171717;         /* Deep black for borders, typography, hard shadows */
  --muted: #66645F;       /* Warm neutral for secondary labels & timestamps */
  --border: #171717;      /* Primary outline token (2px standard) */

  /* Semantic Brand Accents */
  --primary: #C8F169;     /* High-energy Neon Lime (Primary CTAs, Active Nav) */
  --secondary: #B9D9FF;   /* Pastel Sky Blue (Information chips, active filters) */
  --accent: #FF8A65;      /* Warm Tangerine Coral (Purchase alerts, pending actions) */
  --lavender: #D9C8FF;    /* Soft Lavender (Secondary charts & data visualizations) */

  /* Status Indicators (Always accompanied by text & icon for WCAG AA) */
  --success: #287D4F;     /* Forest Green (Pemasukan, Status Aman ✓) */
  --warning: #9A5700;     /* Ochre Amber (Status Menipis ⚠) */
  --danger: #B42318;      /* Deep Crimson (Pengeluaran, Status Habis ✕, Overdue) */

  /* Hard Shadows (Zero Blur Factor) */
  --shadow-sm: 2px 2px 0 var(--ink);
  --shadow-base: 4px 4px 0 var(--ink);
  --shadow-hover: 5px 5px 0 var(--ink);
  --shadow-lg: 6px 6px 0 var(--ink);
  --shadow-active: 2px 2px 0 var(--ink);

  /* Corner Radii Hierarchy */
  --radius-badge: 6px;
  --radius-btn: 8px;
  --radius-input: 8px;
  --radius-card: 10px;
  --radius-modal: 12px;
}
```

### 3.2 Typography & Font Optimization (Space Grotesk & Inter)

Next.js `next/font/google` guarantees zero-layout-shift and local font preloading.

```typescript
// apps/web/src/app/layout.tsx
import { Space_Grotesk, Inter } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});
```

- **Headings (`h1`, `h2`, `h3`, `h4`, `h5`, `h6`)**: Use `font-heading` (`Space Grotesk`), bold weight 600–700, tight tracking.
- **Body & Controls**: Use `font-body` (`Inter`), weights 400–600.
- **Financial & Numerical Figures**: Must always use `tabular-nums` (`font-variant-numeric: tabular-nums`) so numbers align cleanly in tables and cards.
- **Currency Display**: Always format via `formatIDR(value)` from `@rumahkita/contracts` (`Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`).

### 3.3 Breakpoints & Layout Container Matrix

| Viewport Category | Screen Width Range | Layout Pattern | Navigation Strategy | Table Behavior |
|-------------------|-------------------|----------------|---------------------|----------------|
| **Mobile** | `360px` – `767px` (Base `390px`) | Single stacked column, full-width cards | 56px sticky top bar + 64px fixed 5-item bottom nav bar | Reflows into Card Lists |
| **Tablet** | `768px` – `1023px` | 2-column card grid, compact header | Sticky top bar + collapsible drawer | Reflows into Card Lists or responsive scrollable table |
| **Desktop** | `>= 1024px` – `1280px+` | 12-column grid, max-w-7xl | 240px fixed left sidebar + top title bar | TanStack Table with full sorting & pagination |

### 3.4 Desktop Layout Architecture (>= 1024px)

```
+---------------------------------------------------------------------------------------+
|  240px FIXED SIDEBAR          |  DESKTOP MAIN AREA (ml-60, max-w-7xl)                 |
|                               |                                                       |
|  [Logo: RumahKita] [MVP]      |  Top Bar: [Judul Halaman]    [Bulan Ini v] [+ Tambah] |
|  "Urus rumah bareng-bareng."  |-------------------------------------------------------|
|                               |                                                       |
|  +-------------------------+  |  [ Stat Card 1 ] [ Stat Card 2 ] [ Stat 3 ] [ Stat 4 ]|
|  | Rumah Tangga:           |  |                                                       |
|  | [Keluarga Budi    v]    |  |  +-------------------------------------------------+  |
|  | [Pemilik]               |  |  | TanStack Data Table / Recharts Monthly Chart     |  |
|  +-------------------------+  |  | (12-column grid container)                         |  |
|                               |  |                                                 |  |
|  Nav Links:                   |  +-------------------------------------------------+  |
|  * [Dashboard        ]        |                                                       |
|  * [Transaksi (P/K)  ] (ACTIVE|                                                       |
|     Neon Lime bg, 2px border, |                                                       |
|     4px hard shadow)          |                                                       |
|  * [Belanja          ]        |                                                       |
|  * [Inventori        ]        |                                                       |
|  * [Hutang & Piutang ]        |                                                       |
|  * [Laporan          ]        |                                                       |
|  * [Pengaturan       ]        |                                                       |
|                               |                                                       |
|  ---------------------------  |                                                       |
|  User Badge (mt-auto):        |                                                       |
|  [Avatar] Budi Santoso        |                                                       |
|           budi@email.com      |                                                       |
|  [Icon: Logout]               |                                                       |
+---------------------------------------------------------------------------------------+
```

#### Sidebar Navigation Active State Rule
The active navigation link must visually pop with authentic Neo-Brutalism tokens:
- **Active State**:
  `bg-primary text-ink border-2 border-ink shadow-[4px_4px_0_#171717] font-bold rounded-btn`
  Hover: `translate(-1px, -1px) shadow-[5px_5px_0_#171717]`
- **Inactive State**:
  `text-ink/80 hover:text-ink hover:bg-ink/5 border-2 border-transparent hover:border-ink/20 font-medium rounded-btn`

### 3.5 Mobile Layout Architecture (< 1024px, 390px Base)

```
+------------------------------------+
| STICKY TOP BAR (56px, h-14)        |
| [Home Icon] Keluarga Budi v   [+]  |
+------------------------------------+
| SCROLLABLE MAIN CONTENT            |
| (Padding-bottom: pb-24 / 96px!)    |
|                                    |
| [Greeting: "Keuangan Bulan Ini"]   |
| [Periode Selector: Okt 2026]       |
|                                    |
| [Stat Card: Sisa Arus Kas]         |
| [Stat Card: Total Pengeluaran]     |
|                                    |
| [Recent Transactions Card List]    |
| +--------------------------------+ |
| | Beras Rojolele (5 kg)          | |
| | 26 Okt • Dapur • Rp 75.000     | |
| +--------------------------------+ |
| | Token PLN                      | |
| | 25 Okt • Utilitas • Rp 200.000 | |
| +--------------------------------+ |
|                                    |
+------------------------------------+
| FIXED BOTTOM NAV BAR (64px, h-16)  |
|  [Icon]    [Icon]  [Icon]  [Icon]  |
|  Dashb.   Trans.  Belanja  Stok    |
|  [---] (Indicator pill on active)  |
|                               [•••]|
|                              Lain- |
|                               nya  |
+------------------------------------+
```

#### The 5 Bottom Navigation Items:
1. **Dashboard** (`/dashboard`): `LayoutDashboard` icon, label "Dashboard".
2. **Transaksi** (`/transactions` or `/incomes`): `Receipt` icon, label "Transaksi".
3. **Belanja** (`/purchases`): `ShoppingCart` icon, label "Belanja".
4. **Inventori** (`/inventory`): `Package` icon, label "Inventori".
5. **Lainnya** (Trigger for slide-over drawer): `MoreHorizontal` icon, label "Lainnya".
   - Drawer options:
     - Hutang & Piutang (`/debts`)
     - Laporan & Ekspor CSV (`/reports`)
     - Pengaturan Notifikasi & Kategori (`/settings`)
     - Profil Pengguna & Keluar (Logout)

### 3.6 Antislop Rules for Mobile & Desktop Layouts
In strict compliance with `antislop-layoutmobile` and `antislop-ui`:
1. **No Horizontal Scroll Leak**: Every viewport width from 360px up to 1280px must have zero horizontal overflow (`overflow-x: hidden` on viewport wrappers, `min-w-0` on flex/grid children).
2. **Bottom Nav Content Reservation**: The main content wrapper on mobile **MUST** include `pb-24` (96px). The 64px bottom nav will never cover the last list item, submit button, or floating drawer.
3. **44x44px Minimum Tap Targets**: Every mobile bottom nav icon, button, and dropdown trigger must have at least `44px x 44px` clickable bounding area.
4. **No Bare Hamburger**: Secondary options are placed in an explicitly labeled "Lainnya" bottom nav tab with a bottom sheet modal.
5. **Tables Reflow into Card Lists**: Data grids (TanStack Table) are rendered as desktop tables on `>= 1024px` and seamlessly switch to stacked Neo-Brutalist cards on `< 1024px`.

---

## 4. Auth & Household Context Architecture

### 4.1 State Models & Interfaces

```typescript
// apps/web/src/types/auth.ts
export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  isActive: boolean;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  currency?: string;
  timezone?: string;
}

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface HouseholdState {
  activeHousehold: HouseholdSummary | null;
  households: HouseholdSummary[];
  isOwner: boolean;
  isLoading: boolean;
}
```

### 4.2 `AuthProvider` & In-Memory Token Management

```typescript
// apps/web/src/contexts/auth-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile, HouseholdSummary } from '@/types/auth';
import { setApiAuthToken, apiFetch } from '@/lib/api-fetcher';
import { LoginInput } from '@rumahkita/contracts';

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setApiAuthToken(token);
  }, []);

  // 1. Silent token refresh on initial boot
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!res.ok) {
        applyAccessToken(null);
        setUser(null);
        return false;
      }

      const envelope = await res.json();
      const newToken = envelope.data.accessToken;
      applyAccessToken(newToken);

      // Fetch user profile
      const meData = await apiFetch<{ user: UserProfile; households: HouseholdSummary[] }>('/auth/me');
      setUser(meData.user);
      return true;
    } catch {
      applyAccessToken(null);
      setUser(null);
      return false;
    }
  }, [applyAccessToken]);

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));
  }, [refreshSession]);

  // 2. Login action
  const login = async (credentials: LoginInput) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'same-origin',
    });

    const envelope = await res.json();
    if (!res.ok || !envelope.success) {
      throw new Error(envelope.message || 'Login gagal');
    }

    const { accessToken: token, user: userData } = envelope.data;
    applyAccessToken(token);
    setUser(userData);
  };

  // 3. Logout action
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      applyAccessToken(null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

### 4.3 `HouseholdProvider` & Multi-Tenant Context Switching

```typescript
// apps/web/src/contexts/household-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { HouseholdSummary } from '@/types/auth';
import { useAuth } from './auth-context';
import { apiFetch, setApiHouseholdId } from '@/lib/api-fetcher';

const STORAGE_KEY = 'rumahkita_active_household_id';

interface HouseholdContextType {
  activeHousehold: HouseholdSummary | null;
  households: HouseholdSummary[];
  isOwner: boolean;
  isLoading: boolean;
  switchHousehold: (householdId: string) => void;
  refreshHouseholds: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [activeHousehold, setActiveHousehold] = useState<HouseholdSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const switchHousehold = useCallback(
    (householdId: string) => {
      const target = households.find((h) => h.id === householdId);
      if (target) {
        setActiveHousehold(target);
        setApiHouseholdId(target.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, target.id);
        }
      }
    },
    [households]
  );

  const refreshHouseholds = useCallback(async () => {
    if (!isAuthenticated) {
      setHouseholds([]);
      setActiveHousehold(null);
      setApiHouseholdId(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiFetch<{ households: HouseholdSummary[] }>('/auth/me');
      const list = data.households || [];
      setHouseholds(list);

      // Select active household from localStorage, or owner, or first
      const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const matched = list.find((h) => h.id === storedId);
      const owner = list.find((h) => h.role === 'owner');
      const selected = matched || owner || list[0] || null;

      setActiveHousehold(selected);
      setApiHouseholdId(selected ? selected.id : null);
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshHouseholds();
  }, [refreshHouseholds]);

  return (
    <HouseholdContext.Provider
      value={{
        activeHousehold,
        households,
        isOwner: activeHousehold?.role === 'owner',
        isLoading,
        switchHousehold,
        refreshHouseholds,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
}
```

### 4.4 Login Page Architecture (`/login`)

The login page is located at `apps/web/src/app/(auth)/login/page.tsx`:
- **Card**: Centered in viewport (`min-h-screen flex items-center justify-center p-4 bg-bg`).
- **Heading**: "Urus rumah bareng-bareng." in `font-heading font-bold text-2xl text-ink`.
- **Form**:
  - React Hook Form + Zod resolver (`loginSchema` from `@rumahkita/contracts`).
  - Inputs use `@rumahkita/ui` `<Input>` with visible permanent labels:
    - `Email` (auto-lowercase, trimmed).
    - `Kata Sandi` (password type with show/hide toggle).
  - Validation errors displayed immediately under inputs with clear Indonesian copy.
  - Submit Button:
    `Button variant="primary"` with neon lime background, 2px ink border, 4px unblurred shadow.
    Disabled during submission with loading spinner to prevent double-submits.
  - On submit: calls `auth.login(data)`, redirects to `searchParams.get('redirect') || '/dashboard'`.

### 4.5 Route Protection (Next.js Edge Middleware & Client Hydration Guard)

#### Edge Middleware (`apps/web/src/middleware.ts`)
Inspects the HttpOnly `refreshToken` cookie at the edge:
```typescript
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasRefreshToken =
    request.cookies.has('refreshToken') || request.cookies.has('refresh_token');

  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/password') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.');

  // 1. If unauthenticated user accesses protected route -> redirect to /login
  if (!hasRefreshToken && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If authenticated user visits /login -> redirect to /dashboard
  if (hasRefreshToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 5. Directory Layout & File Organization

The application directory structure for `apps/web`:

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # Login form with RHF + Zod
│   │   │   └── layout.tsx             # Centered auth container layout
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Authenticated shell (Sidebar + Top bar + Bottom nav)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # 4 Stat cards, Recharts chart, low stock list
│   │   │   ├── transactions/          # Sub-routes or segmented tabs for Incomes/Expenses
│   │   │   │   └── page.tsx
│   │   │   ├── purchases/             # Purchases list & creation flow
│   │   │   │   └── page.tsx
│   │   │   ├── inventory/             # Stock items list & adjustment dialog
│   │   │   │   └── page.tsx
│   │   │   ├── debts/                 # Hutang & Piutang tabs & payment dialog
│   │   │   │   └── page.tsx
│   │   │   ├── reports/               # Monthly/yearly reports & CSV export
│   │   │   │   └── page.tsx
│   │   │   └── settings/              # Household members, notifications preferences
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   └── [...path]/
│   │   │       └── route.ts           # BFF Catch-All Proxy to NestJS API
│   │   ├── globals.css                # Neo-brutalism theme CSS variables & resets
│   │   ├── layout.tsx                 # Root layout (Space Grotesk + Inter fonts, Providers)
│   │   └── page.tsx                   # Root landing / redirector
│   ├── components/
│   │   ├── layout/
│   │   │   ├── desktop-sidebar.tsx    # 240px fixed left sidebar with active state indicator
│   │   │   ├── mobile-top-bar.tsx     # 56px sticky top bar with household dropdown
│   │   │   ├── mobile-bottom-nav.tsx  # 64px fixed 5-item bottom navigation bar
│   │   │   ├── household-switcher.tsx # Dropdown component for multi-household selection
│   │   │   └── user-badge.tsx         # User initials avatar & logout trigger
│   │   └── ui/                        # Re-exports or web-specific UI overrides
│   ├── contexts/
│   │   ├── auth-context.tsx           # In-memory JWT access token & login/logout methods
│   │   └── household-context.tsx      # Active household selection & multi-tenant switcher
│   ├── lib/
│   │   ├── api-client.ts              # Typed ApiClientError class & error envelope parser
│   │   └── api-fetcher.ts             # Client fetch wrapper with auto 401 refresh interceptor
│   ├── types/
│   │   └── auth.ts                    # User, Household, and Session TypeScript types
│   └── middleware.ts                  # Edge session checker & redirect guard
├── tailwind.config.ts                 # Preset integration from @rumahkita/ui
├── tsconfig.json
└── package.json
```

---

## 6. Implementation Roadmap & Verification Protocol

### Step-by-Step Implementation Sequence for Milestone 4 Workers

1. **Step 1: BFF Proxy Route Handler**
   - Implement `apps/web/src/app/api/[...path]/route.ts`.
   - Verify forwarding to `http://127.0.0.1:4000/api/v1`.
   - Test `Set-Cookie` header propagation from NestJS login/refresh.
2. **Step 2: Client API Fetcher & Error Parser**
   - Implement `apps/web/src/lib/api-client.ts` and `apps/web/src/lib/api-fetcher.ts`.
   - Ensure automatic 401 token refresh queueing and error envelope deserialization.
3. **Step 3: Auth & Household Providers**
   - Implement `apps/web/src/contexts/auth-context.tsx` and `household-context.tsx`.
   - Wire providers into `apps/web/src/app/layout.tsx`.
4. **Step 4: Login Page & Edge Middleware**
   - Build `apps/web/src/app/(auth)/login/page.tsx` using React Hook Form and `@rumahkita/contracts` `loginSchema`.
   - Add `apps/web/src/middleware.ts` for Edge cookie checking and redirecting unauthenticated users.
5. **Step 5: Responsive Shell & Navigation**
   - Implement `DesktopSidebar` (240px fixed, active neon lime pill, user profile badge).
   - Implement `MobileTopBar` (56px sticky, household dropdown).
   - Implement `MobileBottomNav` (64px fixed, 5 items, touch targets >= 44x44px).
   - Add `pb-24` content reservation on mobile layout container.

### Verification Checklist
- [ ] `pnpm --filter @rumahkita/web typecheck` exits with 0 errors.
- [ ] `pnpm --filter @rumahkita/web build` compiles all pages and route handlers cleanly.
- [ ] Navigating to `/dashboard` without session redirects to `/login`.
- [ ] Submitting valid credentials on `/login` sets HttpOnly cookie and redirects to `/dashboard`.
- [ ] At `>= 1024px`, the 240px desktop sidebar displays with active neon lime navigation styling.
- [ ] At `< 1024px` (and specifically 390px base), the 56px top bar and 64px bottom nav display without horizontal scroll.
- [ ] Calling an API endpoint with an expired access token triggers silent token refresh without dropping the user session.
