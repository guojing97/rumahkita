# Forensic Audit Report: Milestone 4 Frontend Web (Next.js App Router)

**Work Product**: `apps/web/` (Milestone 4 - Frontend Web with Next.js App Router)  
**Profile**: General Project (Web Frontend)  
**Integrity Mode**: Development (from `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Source Code Authenticity & Architecture
- **Location**: `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/contexts/`, `apps/web/src/lib/`.
- **BFF Proxy Route Handler (`apps/web/src/app/api/[...path]/route.ts`)**:
  - Genuine reverse HTTP proxy implementation forwarding all methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) to upstream NestJS API at `process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000/api/v1'`.
  - Forwards `authorization`, `x-household-id`, `idempotency-key`, `content-type`, `accept`, `user-agent`, and `cookie` headers.
  - Correctly replicates upstream `Set-Cookie` headers back to client browser.
  - Preserves binary/text `ReadableStream` response body without truncation (enabling CSV streaming exports).
  - Contains **zero canned responses**, **zero mock switch statements**, and returns standard 502 Bad Gateway only upon real upstream connection failure.
- **Client Auth & Context Architecture**:
  - `apps/web/src/lib/api-fetcher.ts`: Implements `apiFetch` with silent 401 token refresh queue mechanism hitting `/api/auth/refresh` and automatic redirection to `/login` upon session invalidation.
  - `apps/web/src/lib/api-client.ts`: `ApiClientError` class parsing NestJS structured error payloads (`{ statusCode, error, message, details, errors }`) and mapping field issues directly to React Hook Form.
  - `apps/web/src/contexts/auth-context.tsx`: Genuine session lifecycle management (`login`, `logout`, `refreshSession`, in-memory access token storage, `/auth/me` profile resolution).
  - `apps/web/src/contexts/household-context.tsx`: Active household multi-tenant selection and synchronization with `localStorage` and `X-Household-Id` request headers.
  - `apps/web/src/middleware.ts`: Next.js Edge Middleware verifying `refreshToken` cookie presence, guarding protected dashboard routes, and redirecting unauthenticated users.
- **Pages & Components State Authenticity**:
  - `apps/web/src/app/(auth)/login/page.tsx`: Real React Hook Form with `zodResolver(loginSchema)` and Next.js Suspense boundary.
  - `apps/web/src/app/(dashboard)/dashboard/page.tsx`: Dynamic dashboard consuming `/api/dashboard?period=...`, rendering 4 StatCards, Recharts interactive BarChart, low stock alerts, and due soon debts.
  - `apps/web/src/app/(dashboard)/transaksi/page.tsx`: Authentic TanStack Table v8 implementation (`useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`) on desktop with responsive reflow to card list on mobile (<768px). Integrates `zodResolver(createIncomeSchema)` and `zodResolver(createExpenseSchema)`.
  - `apps/web/src/app/(dashboard)/belanja/page.tsx`: Procurement draft list with dynamic row items editor, subtotal calculations, cancel modal requiring mandatory reason, and "Selesaikan Pembelian" modal generating client-side UUID idempotency key (`crypto.randomUUID()`) and live stock impact preview.
  - `apps/web/src/app/(dashboard)/inventori/page.tsx`: Inventory stock management with `Aman ✓` / `Menipis ⚠` / `Habis ✕` status badges calculated via `calculateStockStatus`. Manual stock adjustment modal with strict client-side non-negative stock validation (`isNegativeStock`), disabling submission and displaying warnings if final stock < 0, with mandatory reason.
  - `apps/web/src/app/(dashboard)/hutang/page.tsx`: Hutang & Piutang dual tabs, repayment progress bar, Catat Hutang/Piutang modal using `createDebtReceivableSchema`, and Catat Pembayaran modal using `recordPaymentSchema` with real-time overpayment prevention (`isOverpayment = enteredAmount > debt.remainingBalance`).
  - `apps/web/src/app/(dashboard)/laporan/page.tsx`: Monthly and yearly financial analytics with Recharts visualizations (daily trends and 12-month zero-continuity bar chart), breakdown tables, and 1-click RFC 4180 CSV export creating a browser Blob download trigger.
  - `apps/web/src/app/(dashboard)/pengaturan/page.tsx`: Household profile editor, member list, invite modal (`/households/:id/invite`), master categories CRUD, and notification preferences toggles for Email and WhatsApp Cloud API using `updateNotificationPreferenceSchema`.

### 1.2 Anti-Cheat & Forensic Checks
- **Hardcoded Test Outputs Detection**:
  - Ripgrep search across `apps/web/src` for test-bypass patterns returned 0 occurrences.
  - Search for `mock`, `fake`, `dummy`, `TODO`, `FIXME`, `NotImplemented` returned 0 matches in production source.
  - Search for conditional branching based on `process.env.NODE_ENV === 'test'` returned 0 matches.
- **Pre-populated Artifact Detection**:
  - No pre-populated test output mocks or fake attestations exist.
- **Test Integrity**:
  - `tests/e2e/` and `tests/adversarial/` remain untouched and untampered with original timestamps intact.
  - `apps/web/src/__tests__/api-client.test.ts` executes authentic Node.js test runner assertions verifying structured error envelope parsing.

### 1.3 Empirical Verification Tooling Outputs
All four commands were directly and independently executed:

1. **Typecheck (`pnpm --filter @rumahkita/web typecheck`)**:
   ```text
   $ tsc --noEmit
   (exited with code 0)
   ```
2. **Linter (`pnpm --filter @rumahkita/web lint`)**:
   ```text
   $ next lint
   ✔ No ESLint warnings or errors
   (exited with code 0)
   ```
3. **Unit Tests (`pnpm --filter @rumahkita/web test`)**:
   ```text
   $ node --experimental-strip-types --test src/__tests__/**/*.test.ts
   ▶ Web API Client & Error Envelope Tests
     ✔ correctly parses structured API error envelopes (2.110822ms)
     ✔ handles array message formats seamlessly (0.572588ms)
     ✔ handles details fallback when errors array is missing (0.436166ms)
   ✔ Web API Client & Error Envelope Tests (7.119817ms)
   ℹ tests 3
   ℹ suites 1
   ℹ pass 3
   ℹ fail 0
   ℹ cancelled 0
   ℹ skipped 0
   ℹ todo 0
   ℹ duration_ms 985.792086
   (exited with code 0)
   ```
4. **Production Build (`pnpm --filter @rumahkita/web build`)**:
   ```text
   $ next build
     ▲ Next.js 14.2.35

      Creating an optimized production build ...
    ✓ Compiled successfully
      Linting and checking validity of types     ✓ Linting and checking validity of types 
      Collecting page data     ✓ Collecting page data 
    ✓ Generating static pages (12/12)
      Collecting build traces     ✓ Collecting build traces 
      Finalizing page optimization     ✓ Finalizing page optimization 

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
     ├ chunks/5b8f0dd8-4558c853b43c38a5.js  53.6 kB
     ├ chunks/749-86b4374ed5f4de92.js       31.7 kB
     └ other shared chunks (total)          1.96 kB

   ƒ Middleware                             26.6 kB

   ○  (Static)   prerendered as static content
   ƒ  (Dynamic)  server-rendered on demand
   (exited with code 0)
   ```

---

## 2. Logic Chain

1. **Observation 1.1** proves that `apps/web/src/app/api/[...path]/route.ts` implements real Next.js route handling that dynamically forwards HTTP verbs, headers, body streams, and cookies to the backend NestJS service at `http://127.0.0.1:4000/api/v1`.
   - *Inference*: The BFF proxy is genuine and not a facade or mock response generator.
2. **Observation 1.1** confirms all forms across 7 dashboard views and the login page integrate Zod schemas directly from `@rumahkita/contracts` (`loginSchema`, `createIncomeSchema`, `createExpenseSchema`, `createItemSchema`, `stockAdjustmentSchema`, `recordPaymentSchema`, etc.) via `zodResolver`.
   - *Inference*: Client-side contract validation conforms authentically with the monorepo data contract specifications.
3. **Observation 1.1 & 1.2** demonstrate authentic state handling using standard React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`), TanStack Table v8, and custom business guards (preventing negative stock adjustments, preventing debt payment greater than remaining balance, idempotency keys for purchase completion).
   - *Inference*: UI components are interactive, robust web applications rather than static wireframes or cosmetic previews.
4. **Observation 1.2** confirms no test files were modified, bypassed, or weakened, and production code contains zero test-bypass branches.
   - *Inference*: Zero anti-cheat violations detected.
5. **Observation 1.3** empirically verifies that `typecheck`, `lint`, `test`, and `build` compile with exit code 0 and 0 errors across all 12 routes.
   - *Inference*: The implementation compiles cleanly to production assets without syntax, type, or linting defects.

---

## 3. Caveats

- Live end-to-end data communication through the BFF proxy relies on the NestJS backend API (`@rumahkita/api` on port 4000) and PostgreSQL database being booted during integration execution.
- End-to-end browser automation testing across viewports (390px mobile vs 1280px desktop) is delegated to the designated `qa-playwright` agent per the team orchestration workflow.

---

## 4. Conclusion

The work product for **Milestone 4 (Frontend Web with Next.js App Router in `apps/web/`)** has been forensically audited and verified. All components, pages, proxy handlers, contracts integrations, design tokens, and build pipelines are authentic, robust, and free of any integrity violations or shortcuts.

Final Verdict: **CLEAN**

---

## 5. Verification Method

To independently reproduce and verify this audit:

```bash
# 1. Typecheck the Next.js web application
pnpm --filter @rumahkita/web typecheck

# 2. Lint the Next.js web application
pnpm --filter @rumahkita/web lint

# 3. Run client unit tests
pnpm --filter @rumahkita/web test

# 4. Clean cache and build production assets
pnpm --filter @rumahkita/web run clean
pnpm --filter @rumahkita/web build
```

Expected result: All commands exit with code 0 and 0 errors.
