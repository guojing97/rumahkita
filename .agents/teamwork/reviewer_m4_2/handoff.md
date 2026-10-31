# Review & Adversarial Challenge Report: Milestone 4 Frontend Web

## 1. Observation

### 1.1 Integrity & Facade Check
- **Integrity Violations**: None found. Zero hardcoded test results, fake responses, or stub facades detected in `apps/web/src/`.
- **API Data Binding**: All 7 core pages and modals bind to dynamic backend endpoints via `apiFetch` and the Next.js BFF proxy `/api/*`:
  - `apps/web/src/app/(dashboard)/dashboard/page.tsx:80`: calls `apiFetch<DashboardData>('/dashboard?period=...')`.
  - `apps/web/src/app/(dashboard)/transaksi/page.tsx:79-85`: calls `apiFetch` for `/incomes`, `/expenses`, `/expense-categories`, `/income-sources`, `/income-categories`.
  - `apps/web/src/app/(dashboard)/belanja/page.tsx:90-94, 998`: calls `apiFetch` for `/purchases`, `/expense-categories`, `/items`, and `POST /purchases/:id/complete` with client-generated `crypto.randomUUID()` idempotency key.
  - `apps/web/src/app/(dashboard)/inventori/page.tsx:84, 799`: calls `apiFetch` for `/items` and `POST /items/:id/stock-adjustments`.
  - `apps/web/src/app/(dashboard)/hutang/page.tsx:85, 843`: calls `apiFetch` for `/debts-receivables` and `POST /debts-receivables/:id/payments`.
  - `apps/web/src/app/(dashboard)/laporan/page.tsx:72, 77, 108`: calls `apiFetch` for `/reports/monthly`, `/reports/yearly`, and `/reports/export/csv` with streaming text download.
  - `apps/web/src/app/(dashboard)/pengaturan/page.tsx:98-103`: calls `apiFetch` for `/household`, `/income-sources`, `/expense-categories`, `/income-categories`, and `/settings/notifications`.

### 1.2 BFF Proxy Route Handler (`apps/web/src/app/api/[...path]/route.ts`)
- Target URL routing at lines 6-8: preserves `params.path.join('/')` and `req.nextUrl.search`.
- Header forwarding at lines 13-25, 28-31: forwards `authorization`, `x-household-id`, `idempotency-key`, `content-type`, `accept`, `user-agent`, and `cookie`.
- Streaming response preservation at lines 65-69: returns `new NextResponse(upstreamRes.body, ...)` so stream is not buffered in memory (crucial for large CSV export).
- Multi-cookie propagation at lines 58-73: uses `upstreamRes.headers.getSetCookie()` or `upstreamRes.headers.get('set-cookie')` and appends to `res.headers`.
- Gateway error handling at lines 76-88: returns structured 502 Bad Gateway response with Indonesian error message if backend is unreachable.

### 1.3 Auth & State Interceptors (`apps/web/src/lib/api-fetcher.ts`, `apps/web/src/contexts/auth-context.tsx`)
- In-memory token storage: access token is retained only in memory (`currentAccessToken`) and passed via `Authorization: Bearer <token>`, preventing XSS token exfiltration.
- 401 Silent Token Refresh & Request Queue at lines 55-97:
  - When a 401 is received, `isRefreshing` mutex ensures only a single request calls `/api/auth/refresh`.
  - Concurrent requests are queued into `refreshQueue: Array<(token: string) => void>`.
  - Upon successful refresh, all queued callbacks are replayed with the new access token.
  - If refresh fails, queue is cleared, token wiped, and visitor redirected to `/login?redirect=...`.
- Multi-tenant tenant header: `options.householdId || activeHouseholdId` populates `X-Household-Id` header on every request.

### 1.4 Form Validation & Business Rule Pre-Checks
- **Catat Pemasukan & Pengeluaran**: validated with `zodResolver(createIncomeSchema)` and `zodResolver(createExpenseSchema)`. Nominal <= 0 is blocked.
- **Manual Stock Adjustment (`apps/web/src/app/(dashboard)/inventori/page.tsx:782-793`)**:
  - `const resultingStock = item.quantityOnHand + delta;`
  - Blocks negative stock: `if (resultingStock < 0) { setError('Stok akhir tidak boleh kurang dari 0!'); return; }`.
  - Enforces mandatory reason: `if (!finalReason) { setError('Alasan penyesuaian stok wajib diisi'); return; }`.
- **Catat Pembayaran Hutang (`apps/web/src/app/(dashboard)/hutang/page.tsx:832-840, 961`)**:
  - `const isOverpayment = enteredAmount > debt.remainingBalance;`
  - Blocks overpayment: `if (isOverpayment) { setError(...); return; }`.
  - Disables submit button: `disabled={isOverpayment}` with real-time error banner and remaining balance preview.
- **Selesaikan Pembelian (`apps/web/src/app/(dashboard)/belanja/page.tsx:978-990, 997-1004`)**:
  - Matched items preview displays `currentStock → afterStock` and `+{quantity}` before confirmation.
  - Generates RFC 4122 v4 UUID `const idempotencyKey = crypto.randomUUID()` sent in both headers and payload.

### 1.5 UI, Responsiveness, and Design System
- Design tokens in `apps/web/src/app/globals.css`: `--bg: #FFFDF7`, `--ink: #171717`, `--primary: #C8F169`, `--secondary: #B9D9FF`, `--accent: #FF8A65`.
- Hard drop shadows (`4px 4px 0 #171717`, `6px 6px 0 #171717`), 2px solid ink borders.
- Typography: Space Grotesk headings, Inter body, and `tabular-nums` on all currency values.
- Badges in `packages/ui/src/components/badge.tsx`: `Aman ✓` (`#D1FAE5`/`#065F46`), `Menipis ⚠` (`#FEF3C7`/`#92400E`), `Habis ✕` (`#FEE2E2`/`#991B1B`), `Jatuh Tempo Terlewat ⚠`. Meets WCAG AA contrast.
- Responsive reflow:
  - Mobile (390px): 56px sticky top bar, 64px fixed 5-item bottom nav (Dashboard, Transaksi, Belanja, Inventori, Lainnya drawer) with >= 44x44px touch targets.
  - Tables reflow to stacked Neo-brutalism cards (`hidden md:block` for table, `md:hidden` for cards).
  - Layout bottom padding `pb-24` reserves 96px for the bottom nav bar, preventing UI occlusion.

### 1.6 Verification Tool Commands & Results
- **Typecheck**:
  ```bash
  pnpm --filter @rumahkita/web typecheck
  ```
  Result: `tsc --noEmit` exited code 0 (0 errors).
- **Lint**:
  ```bash
  pnpm --filter @rumahkita/web lint
  ```
  Result: `next lint` exited code 0 ("✔ No ESLint warnings or errors").
- **Production Build**:
  ```bash
  pnpm --filter @rumahkita/web build
  ```
  Result: Next.js 14.2.35 production build exited code 0. All 12 routes generated cleanly:
  `○ /`, `○ /_not-found`, `ƒ /api/[...path]`, `○ /belanja`, `○ /dashboard`, `○ /hutang`, `○ /inventori`, `○ /laporan`, `○ /login`, `○ /pengaturan`, `○ /transaksi`, `ƒ Middleware`.
- **Test Suite Execution (Default Script)**:
  ```bash
  pnpm --filter @rumahkita/web test
  ```
  Command defined in `apps/web/package.json:11`:
  `"test": "node --experimental-strip-types --test src/__tests__/**/*.test.ts"`
  Result: Exited code 1 with:
  ```
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/mac/Projects/03-Labs/RumahKita/apps/web/src/lib/api-client' imported from /Users/mac/Projects/03-Labs/RumahKita/apps/web/src/lib/api-fetcher.ts
  ```
- **Test Suite Execution with Custom Loader**:
  ```bash
  node --experimental-strip-types --loader ./src/__tests__/loader.mjs --test src/__tests__/**/*.test.ts
  ```
  Result: Exited code 0 with all 15 tests passing across 6 suites:
  - `api-client.test.ts`: 3/3 passed.
  - `adversarial-integration.test.ts`: 12/12 passed (BFF proxy forwarding, CSV streaming, 502 fallback, 422/400/401/403 parsing, 401 token refresh queue replay, negative nominal rejection, stock adjustment non-negative check, debt overpayment rejection, purchase UUID idempotency).

---

## 2. Logic Chain

1. **Premise**: In Node.js native ESM with `--experimental-strip-types`, relative imports without explicit file extensions (`.ts`, `.js`) throw `ERR_MODULE_NOT_FOUND` unless an ESM module resolution loader or TypeScript transpile step is used.
2. **Observation**: `apps/web/src/lib/api-fetcher.ts:1` imports `ApiClientError` using `import { ApiClientError } from './api-client';` (without `.ts`).
3. **Observation**: While `apps/web/src/__tests__/loader.mjs` was created to resolve missing extensions, `apps/web/package.json`'s `test` script was configured without `--loader ./src/__tests__/loader.mjs`.
4. **Deduction**: As a consequence, running `pnpm --filter @rumahkita/web test` fails out of the box with exit code 1 when evaluating `adversarial-integration.test.ts`.
5. **Deduction**: All 15 unit and adversarial tests pass completely (100% green) once the loader is supplied or once the import in `api-fetcher.ts` is explicitly extended.
6. **Deduction**: The core business logic, BFF proxy, auth state machine, forms, modals, and layouts in `apps/web` are fully verified, robust, and correctly implemented without integrity violations. However, the broken default `test` script in `package.json` must be rectified so continuous integration commands succeed cleanly.

---

## 3. Caveats

- End-to-end browser interaction (clicking and typing via automated headless browser) is assigned to the `qa-playwright` subagent in the team delegation workflow; unit and HTTP-level mocking tests were verified here.
- The NestJS backend server (`http://127.0.0.1:4000/api/v1`) must be running with PostgreSQL and Redis when executing live runtime proxying outside of mock/unit test environments.

---

## 4. Conclusion

### **Verdict**: REQUEST_CHANGES

### Findings:

#### [Major] Finding 1: `pnpm --filter @rumahkita/web test` fails due to extensionless import in raw Node ESM
- **What**: Running `pnpm --filter @rumahkita/web test` throws `ERR_MODULE_NOT_FOUND: Cannot find module '.../apps/web/src/lib/api-client' imported from .../apps/web/src/lib/api-fetcher.ts`.
- **Where**:
  - `apps/web/src/lib/api-fetcher.ts:1`: `import { ApiClientError } from './api-client';`
  - `apps/web/package.json:11`: `"test": "node --experimental-strip-types --test src/__tests__/**/*.test.ts"`
- **Why**: Node `--experimental-strip-types` requires explicit extensions or a resolution hook. When `adversarial-integration.test.ts` was introduced, it imports `api-fetcher.ts`, triggering extensionless import failure under standard Node ESM.
- **Suggestion**: Update either:
  1. `apps/web/package.json:11` to include the existing loader:
     `"test": "node --experimental-strip-types --loader ./src/__tests__/loader.mjs --test src/__tests__/**/*.test.ts"`
     OR
  2. `apps/web/src/lib/api-fetcher.ts:1` to use explicit `.ts` extension:
     `import { ApiClientError } from './api-client.ts';`

Once this 1-line configuration fix is applied, all 15 tests pass and the monorepo test suite will be 100% green.

---

## 5. Verification Method

To verify the findings and overall application state:

1. **Verify Typecheck**:
   ```bash
   pnpm --filter @rumahkita/web typecheck
   ```
   *Expected*: Exits 0 with 0 errors.

2. **Verify Lint**:
   ```bash
   pnpm --filter @rumahkita/web lint
   ```
   *Expected*: Exits 0 ("✔ No ESLint warnings or errors").

3. **Verify Production Build**:
   ```bash
   pnpm --filter @rumahkita/web build
   ```
   *Expected*: Exits 0, compiling all 12 routes (`/`, `/_not-found`, `/api/[...path]`, `/belanja`, `/dashboard`, `/hutang`, `/inventori`, `/laporan`, `/login`, `/pengaturan`, `/transaksi`, `Middleware`).

4. **Reproduce Test Failure (Finding 1)**:
   ```bash
   pnpm --filter @rumahkita/web test
   ```
   *Observed*: Exits 1 with `ERR_MODULE_NOT_FOUND` in `src/lib/api-fetcher.ts`.

5. **Verify All 15 Tests Pass with Loader**:
   ```bash
   cd apps/web && node --experimental-strip-types --loader ./src/__tests__/loader.mjs --test src/__tests__/**/*.test.ts
   ```
   *Expected*: Exits 0 with 15/15 tests passing across 6 test suites.
