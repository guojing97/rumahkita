# Handoff Report: Remediation M4-2 (Frontend Web Test Script Resolution)

**Agent**: `worker_m4_remediation_2`  
**Milestone**: Milestone 4 (Frontend Web with Next.js App Router)  
**Task**: Remediate Reviewer 2 Finding (test suite module resolution failure under raw Node ESM)  
**Status**: Completed & Verified  

---

## 1. Observation

1. **Reviewer Finding**:
   - In `reviewer_m4_2/handoff.md`, Reviewer 2 reported that executing `pnpm --filter @rumahkita/web test` failed with exit code 1 and error:
     ```
     Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/mac/Projects/03-Labs/RumahKita/apps/web/src/lib/api-client' imported from /Users/mac/Projects/03-Labs/RumahKita/apps/web/src/lib/api-fetcher.ts
     ```
   - In addition, running Node ESM without the custom resolver loader failed to resolve `next/server` imported by the BFF proxy route handler (`apps/web/src/app/api/[...path]/route.ts`).

2. **Root Cause Analysis**:
   - `apps/web/package.json:11`: The `"test"` script was configured as:
     `"test": "node --experimental-strip-types --test src/__tests__/**/*.test.ts"`
     which lacked the custom loader `--loader ./src/__tests__/loader.mjs`.
   - `apps/web/src/lib/api-fetcher.ts:1`: Imported `ApiClientError` using extensionless path `import { ApiClientError } from './api-client';`.
   - `apps/web/src/__tests__/adversarial-integration.test.ts:1-2`: Contained `import { register } from 'node:module'; register('./loader.mjs', import.meta.url);`, which triggered Node 22 deprecation warning `[DEP0205] DeprecationWarning: module.register() is deprecated` and did not resolve top-level static imports in other test files.

3. **Remediation Actions Applied**:
   - `apps/web/package.json`: Updated the `"test"` script to:
     ```json
     "test": "node --experimental-strip-types --loader ./src/__tests__/loader.mjs --test src/__tests__/**/*.test.ts"
     ```
   - `apps/web/src/lib/api-fetcher.ts:1`: Updated import to explicit `.ts` extension:
     ```ts
     import { ApiClientError } from './api-client.ts';
     ```
   - `apps/web/src/__tests__/adversarial-integration.test.ts:1-3`: Removed redundant runtime `module.register()` calls, eliminating `[DEP0205]` deprecation warnings while letting the CLI loader handle specifier resolution cleanly.

4. **Empirical Tool Command Outputs**:
   - `pnpm --filter @rumahkita/web test`:
     ```
     $ node --experimental-strip-types --loader ./src/__tests__/loader.mjs --test src/__tests__/**/*.test.ts
     ▶ Adversarial Verification Suite: Milestone 4 Web & BFF
       ▶ BFF Proxy Route Handler Robustness
         ✔ forwards query strings, headers (X-Household-Id, Authorization, Idempotency-Key, Cookie), and body payload (44.7ms)
         ✔ correctly streams CSV content and propagates Content-Disposition header (5.1ms)
         ✔ returns 502 Bad Gateway with standard error envelope when backend is unreachable (8.2ms)
       ✔ BFF Proxy Route Handler Robustness (67.5ms)
       ▶ ApiClientError Envelope & Field-Error Parsing
         ✔ handles 422 Unprocessable Entity with multiple validation errors (0.36ms)
         ✔ handles 400 Bad Request with array message and fallback details (0.16ms)
         ✔ handles 401 Unauthorized and 403 Forbidden (0.15ms)
       ✔ ApiClientError Envelope & Field-Error Parsing (0.97ms)
       ▶ apiFetch Silent Token Refresh & Request Replay
         ✔ automatically intercepts 401, calls /api/auth/refresh, updates auth token, and replays request (5.1ms)
       ✔ apiFetch Silent Token Refresh & Request Replay (5.4ms)
       ▶ Form Validation & Atomic Modal Rules
         ✔ rejects negative and zero nominals across income, expense, debt, and payment schemas (2.5ms)
         ✔ enforces stock adjustment invariants: prevents negative stock and requires valid reason (0.46ms)
         ✔ enforces debt repayment client constraint: rejects payment exceeding remaining balance (0.26ms)
         ✔ verifies purchase completion modal generates valid RFC 4122 v4 UUID and previews stock increment (0.79ms)
         ✔ verifies RFC 4180 CSV export download filename construction and content-type handling (0.15ms)
       ✔ Form Validation & Atomic Modal Rules (4.4ms)
     ✔ Adversarial Verification Suite: Milestone 4 Web & BFF (79.2ms)
     ▶ Web API Client & Error Envelope Tests
       ✔ correctly parses structured API error envelopes (0.88ms)
       ✔ handles array message formats seamlessly (0.18ms)
       ✔ handles details fallback when errors array is missing (0.17ms)
     ✔ Web API Client & Error Envelope Tests (2.4ms)
     ℹ tests 15 | suites 6 | pass 15 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 374ms
     ```
     Exited code 0.
   - `pnpm --filter @rumahkita/web typecheck`:
     ```
     $ tsc --noEmit
     ```
     Exited code 0 (0 errors).
   - `pnpm --filter @rumahkita/web lint`:
     ```
     $ next lint
     ✔ No ESLint warnings or errors
     ```
     Exited code 0.
   - `pnpm --filter @rumahkita/web build`:
     ```
     $ next build
     ▲ Next.js 14.2.35
     Creating an optimized production build ...
     ✓ Compiled successfully
     ✓ Linting and checking validity of types
     ✓ Collecting page data
     ✓ Generating static pages (12/12)
     ✓ Collecting build traces
     ✓ Finalizing page optimization

     Route (app)                              Size     First Load JS
     ┌ ○ /                                    175 B          96.2 kB
     ├ ○ /_not-found                          872 B          88.2 kB
     ├ ƒ /api/[...path]                       0 B                0 B
     ├ ○ /belanja                             8.2 kB          140 kB
     ├ ○ /dashboard                           4.13 kB         242 kB
     ├ ○ /hutang                              7.71 kB         153 kB
     ├ ○ /inventori                           7.46 kB         153 kB
     ├ ○ /laporan                             6.1 kB          235 kB
     ├ ○ /login                               1.56 kB         134 kB
     ├ ○ /pengaturan                          7.06 kB         125 kB
     └ ○ /transaksi                           7.1 kB          153 kB
     + First Load JS shared by all            87.3 kB
     ƒ Middleware                             26.6 kB
     ```
     Exited code 0 (all 12 routes generated cleanly).
   - `pnpm turbo run typecheck test lint`:
     ```
     Tasks: 15 successful, 15 total (across 8 packages in monorepo)
     Time: 3.002s
     ```
     Exited code 0.

---

## 2. Logic Chain

1. **Premise**: Under Node native ESM `--experimental-strip-types`, specifiers must include explicit extensions or use an ESM loader to resolve extensions and virtual specifiers such as `next/server -> next/server.js`.
2. **Analysis**:
   - `apps/web/src/__tests__/loader.mjs` was already designed and created to resolve `next/server` to `next/server.js` and append extensions (`.ts`, `.tsx`, `.js`, `/index.ts`).
   - However, `package.json` had `"test": "node --experimental-strip-types --test src/__tests__/**/*.test.ts"` without `--loader ./src/__tests__/loader.mjs`.
   - Simultaneously, `api-fetcher.ts` omitted the extension on `./api-client`.
3. **Action**:
   - Added `--loader ./src/__tests__/loader.mjs` into `package.json`'s test script.
   - Updated `api-fetcher.ts:1` to explicitly import `'./api-client.ts'`.
   - Removed deprecated `register('./loader.mjs')` calls from `adversarial-integration.test.ts`.
4. **Verification**:
   - Executing `pnpm --filter @rumahkita/web test` now passes all 15 tests across 6 test suites with 0 failures and 0 unhandled module errors.
   - TypeScript compilation (`pnpm --filter @rumahkita/web typecheck`) succeeds with 0 errors (`allowImportingTsExtensions: true` is configured in `tsconfig.json`).
   - ESLint (`pnpm --filter @rumahkita/web lint`) succeeds with 0 warnings or errors.
   - Next.js production build (`pnpm --filter @rumahkita/web build`) builds all 12 routes with exit code 0.
   - Monorepo `pnpm turbo run typecheck test lint` succeeds across all 8 packages.

---

## 3. Caveats

- Node CLI prints an experimental warning `--experimental-loader may be removed in the future; instead use register()`, which is standard Node 22 behavior when passing `--loader`.
- Live network requests between Next.js BFF proxy `/api/*` and the backend require NestJS, Postgres, and Redis to be running on their standard ports during full system runtime; isolated test mocks verify proxy forwarding and error envelopes independently.

---

## 4. Conclusion

The module resolution failure reported by Reviewer 2 in Finding 1 has been completely resolved. All 15 web tests run and pass out-of-the-box via `pnpm --filter @rumahkita/web test`. Typecheck, lint, Next.js build (12 routes), and monorepo Turborepo runs all exit cleanly with code 0.

---

## 5. Verification Method

To independently verify the remediation:

1. **Run Web Test Suite**:
   ```bash
   pnpm --filter @rumahkita/web test
   ```
   *Expect*: Exits code 0 with 15/15 tests passing.

2. **Run Web Typecheck**:
   ```bash
   pnpm --filter @rumahkita/web typecheck
   ```
   *Expect*: Exits code 0 with 0 errors.

3. **Run Web Lint**:
   ```bash
   pnpm --filter @rumahkita/web lint
   ```
   *Expect*: Exits code 0 with "✔ No ESLint warnings or errors".

4. **Run Web Production Build**:
   ```bash
   pnpm --filter @rumahkita/web build
   ```
   *Expect*: Exits code 0 with all 12 routes compiled cleanly.

5. **Run Monorepo Turbo Check**:
   ```bash
   pnpm turbo run typecheck test lint
   ```
   *Expect*: Exits code 0 across all 8 packages in the monorepo.
