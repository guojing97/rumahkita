# Handoff Report: Milestone 4 Frontend Web Implementation

## 1. Observation
- **Package Scope**: Frontend application located at `apps/web/` in a Turborepo monorepo with workspace packages `@rumahkita/contracts`, `@rumahkita/ui`, `@rumahkita/db`, `@rumahkita/api`, and `@rumahkita/worker`.
- **BFF Proxy Route Handler**:
  - `apps/web/src/app/api/[...path]/route.ts`: Proxies all `/api/*` HTTP requests (GET, POST, PATCH, PUT, DELETE) to the NestJS backend at `http://127.0.0.1:4000/api/v1`.
  - Forwards `Authorization`, `X-Household-Id`, `Idempotency-Key`, `Content-Type`, and `Cookie` headers.
  - Forwards upstream `Set-Cookie` headers back to client browser.
  - Streams response body chunks with binary/text content-type preservation for CSV file exports.
- **API Client & Auth Layer**:
  - `apps/web/src/lib/api-client.ts`: Exports `ApiClientError` class parsing structured `{ statusCode, error, message, details, errors }` backend envelopes and field errors.
  - `apps/web/src/lib/api-fetcher.ts`: Implements `apiFetch` with silent 401 token refresh queue and automated fallback to `/login`.
  - `apps/web/src/contexts/auth-context.tsx`: Manages in-memory access token, user session, login, and logout.
  - `apps/web/src/contexts/household-context.tsx`: Handles multi-tenant active household selection and syncs with `localStorage`.
  - `apps/web/src/middleware.ts`: Next.js Edge middleware verifying `refreshToken` cookie for protected `/dashboard/*` routes and redirecting unauthenticated visitors to `/login`.
- **UI Primitives & Neo-Brutalism Design System**:
  - Tokens: `--bg: #FFFDF7` (Warm Cream), `--ink: #171717` (Deep Charcoal), `--primary: #C8F169` (Neon Lime), surfaces `#FFFFFF`, borders `2px solid #171717`, unblurred hard shadows `4px 4px 0px #171717`.
  - Badges in `packages/ui/src/components/badge.tsx`: `Aman ✓` (`#D1FAE5`/`#065F46`), `Menipis ⚠` (`#FEF3C7`/`#92400E`), `Habis ✕` (`#FEE2E2`/`#991B1B`).
  - `apps/web/src/components/ui/idr-input.tsx`: Neo-brutalism Rupiah integer input with formatted `Rp ` display and pure integer return.
  - `apps/web/src/components/ui/select.tsx`: Neo-brutalism select with visible label, 2px border, and validation slot.
  - `apps/web/src/components/ui/dialog.tsx`: Responsive Neo-brutalism dialog (centered modal on desktop, animated bottom-sheet on mobile).
- **Navigation Shell**:
  - `apps/web/src/components/layout/desktop-sidebar.tsx`: 240px fixed left sidebar with active neon lime navigation pills.
  - `apps/web/src/components/layout/mobile-top-bar.tsx`: 56px sticky top bar with household switcher and user initials.
  - `apps/web/src/components/layout/mobile-bottom-nav.tsx`: 64px fixed 5-item bottom nav with >=44px touch targets.
  - `apps/web/src/components/layout/more-menu-drawer.tsx`: Drawer for secondary navigation items.
  - `apps/web/src/app/(dashboard)/layout.tsx`: Authenticated shell with `pb-24` (96px) bottom padding to ensure zero bottom nav obstruction on mobile.
- **All 7 Core Pages + Login**:
  - `apps/web/src/app/(auth)/login/page.tsx`: Neo-brutalism login form wrapped in Suspense boundary, resolving `next build` prerender requirement.
  - `apps/web/src/app/(dashboard)/dashboard/page.tsx`: 4 StatCards, month/year period filter, Recharts cashflow bar chart, recent transactions, low stock items alert, due soon debts.
  - `apps/web/src/app/(dashboard)/transaksi/page.tsx`: TanStack Table (desktop) / Stacked Cards (mobile), search, type filters, Catat Pemasukan and Catat Pengeluaran modals.
  - `apps/web/src/app/(dashboard)/belanja/page.tsx`: Procurement draft list, dynamic items rows editor with subtotal, "Selesaikan Pembelian" modal with stock increment preview and client UUID idempotency key, cancel draft modal.
  - `apps/web/src/app/(dashboard)/inventori/page.tsx`: Inventory stock list with status badges, Add/Edit Item modal, Manual Stock Adjustment modal with client-side negative stock validation and mandatory reason, stock history drawer.
  - `apps/web/src/app/(dashboard)/hutang/page.tsx`: Hutang & Piutang dual tabs, repayment progress bar, Catat Hutang/Piutang modal, Catat Pembayaran modal with real-time balance validation.
  - `apps/web/src/app/(dashboard)/laporan/page.tsx`: Monthly/Yearly cashflow views, 12-month zero-continuity Recharts bar chart, category breakdown tables, and 1-click Indonesian RFC 4180 CSV streaming export button.
  - `apps/web/src/app/(dashboard)/pengaturan/page.tsx`: Household profile, members list, invite member modal, master categories, and notification preferences toggles (Email and WhatsApp).
- **Command Results**:
  - `pnpm --filter @rumahkita/web typecheck` -> `tsc --noEmit` exited code 0 (0 errors).
  - `pnpm --filter @rumahkita/web lint` -> `next lint` exited code 0 ("✔ No ESLint warnings or errors").
  - `pnpm --filter @rumahkita/web test` -> Node test runner exited code 0 ("✔ 3 tests passed").
  - `pnpm --filter @rumahkita/web build` -> Next.js 14.2.35 production build exited code 0 (all 12 routes generated cleanly).
  - `pnpm turbo run build typecheck test lint` -> All 8 packages in monorepo built, typechecked, linted, and tested with code 0.

## 2. Logic Chain
- **Observation 2.1**: Next.js 14 requires search parameter hooks (`useSearchParams()`) to be enclosed in a `<Suspense>` boundary during static page generation.
  - **Deduction**: Wrapping `LoginForm` within `<Suspense fallback={<LoadingFallback />}>` in `apps/web/src/app/(auth)/login/page.tsx` satisfies the Next.js compiler and allows `login` to be statically prerendered without runtime de-opt.
- **Observation 2.2**: The BFF proxy must support large CSV streaming reports and preserve response headers without truncation.
  - **Deduction**: Utilizing `new Response(res.body, { status: res.status, headers: responseHeaders })` in `apps/web/src/app/api/[...path]/route.ts` directly streams the underlying `ReadableStream` from NestJS to the client, preserving `Content-Disposition`, `Content-Type`, and `Set-Cookie`.
- **Observation 2.3**: TanStack Table v9 introduced API changes (`createCoreRowModel`) incompatible with standard TanStack v8 hooks used across the ecosystem.
  - **Deduction**: Downgrading to `@tanstack/react-table@^8.21.3` restored `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, and `getFilteredRowModel`, ensuring type-safe sorting and filtering on both desktop and mobile views.
- **Observation 2.4**: Mobile devices (<768px) cannot legibly render wide financial tables with 7+ columns.
  - **Deduction**: Responsive dual-rendering pattern (`hidden md:block` for table, `block md:hidden` for stacked Neo-brutalism cards) provides optimal touch-based ergonomics while maintaining identical data binding and sorting.

## 3. Caveats
- The application connects to the NestJS backend at `http://127.0.0.1:4000/api/v1` via the BFF proxy. Running live end-to-end data fetching requires the NestJS backend server (`@rumahkita/api`) and PostgreSQL/Redis instances to be actively listening on their configured ports.
- E2E browser automation tests will be executed by the designated `qa-playwright` agent during the QA phase as mandated by the project delegation workflow.

## 4. Conclusion
Milestone 4 (Frontend Web) is complete, robust, and verified. All 7 core pages, authentication, BFF proxy route handler, Neo-brutalism design tokens, responsive desktop/mobile shells, and unit test suites are fully implemented with real state and 0 dummy facades. Typecheck, build, lint, and unit test suites across the monorepo pass cleanly.

## 5. Verification Method
To independently verify the implementation:
1. **Typecheck Web App**:
   ```bash
   pnpm --filter @rumahkita/web typecheck
   ```
   *Expected result*: Exits 0 with no errors.
2. **Lint Web App**:
   ```bash
   pnpm --filter @rumahkita/web lint
   ```
   *Expected result*: Exits 0 with "✔ No ESLint warnings or errors".
3. **Run Unit Tests**:
   ```bash
   pnpm --filter @rumahkita/web test
   ```
   *Expected result*: Exits 0 with 3/3 tests passing.
4. **Build Production Assets**:
   ```bash
   pnpm --filter @rumahkita/web build
   ```
   *Expected result*: Exits 0, compiling all 12 routes (`/`, `/_not-found`, `/api/[...path]`, `/belanja`, `/dashboard`, `/hutang`, `/inventori`, `/laporan`, `/login`, `/pengaturan`, `/transaksi`, `middleware`).
5. **Verify Monorepo Integrity**:
   ```bash
   pnpm turbo run build typecheck test lint
   ```
   *Expected result*: All 8 packages in scope complete with code 0.
