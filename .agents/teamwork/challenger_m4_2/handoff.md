# Handoff Report: Challenger M4-2 (Frontend Web & BFF Integration)

**Milestone**: Milestone 4 (Frontend Web with Next.js App Router)  
**Agent**: `challenger_m4_2`  
**Role**: Empirical Challenger (critic, specialist)  
**Verdict**: **APPROVE**

---

## 1. Observation

1. **BFF Proxy Route Handler (`apps/web/src/app/api/[...path]/route.ts`)**:
   - Lines 13–25: Forwards `authorization`, `x-household-id`, `idempotency-key`, `content-type`, `accept`, and `user-agent` headers verbatim to upstream NestJS backend.
   - Lines 27–31: Preserves and forwards `cookie` header (including `refreshToken`).
   - Lines 33–37: Streams request body for non-GET/HEAD methods via `ReadableStream` with `duplex: 'half'`.
   - Lines 49–56: Preserves upstream `content-type` and `content-disposition` headers (critical for CSV streaming exports).
   - Lines 57–74: Extracts upstream `Set-Cookie` headers via `getSetCookie()` and replicates them onto downstream `NextResponse`.
   - Lines 76–88: Catches upstream connection errors and returns a 502 Bad Gateway response formatted with the standard error envelope `{ success: false, statusCode: 502, error: 'Bad Gateway', message: 'Tidak dapat terhubung ke server backend RumahKita' }`.

2. **API Client & Silent Token Refresh (`apps/web/src/lib/api-client.ts`, `apps/web/src/lib/api-fetcher.ts`)**:
   - `ApiClientError` (`apps/web/src/lib/api-client.ts:3-34`): Implements structured error parsing for 400, 401, 403, and 422 HTTP responses. Provides `getFieldError(fieldName)` method matching against `errors` array (`{ field, message }`) and fallback `details` array (`{ field, issue }`). Formats string array messages by joining with `', '`.
   - `apiFetch` (`apps/web/src/lib/api-fetcher.ts:29-125`): On status 401 (excluding `/auth/login` and `/auth/refresh`), automatically initiates token refresh to `/api/auth/refresh`. Concurrently queued requests are stored in `refreshQueue` until refresh completes. Once new token is received, updates in-memory token via `setApiAuthToken()` and replays queued requests with `Authorization: Bearer <newToken>`. Detects `text/csv` content-type and returns raw text without JSON parse failure.

3. **Form Validations & Modal Constraints**:
   - **Negative Nominal Rejection**: `idrAmountSchema` (`packages/contracts/src/common/idr.ts:3-10`) enforces integer values `.positive('Nominal harus lebih dari 0')`. Inputs in `apps/web/src/app/(dashboard)/transaksi/page.tsx` (`createIncomeSchema`, `createExpenseSchema`), `apps/web/src/app/(dashboard)/hutang/page.tsx` (`createDebtReceivableSchema`, `recordPaymentSchema`) strictly reject negative nominals and zero amounts.
   - **Stock Adjustment Client Validation** (`apps/web/src/app/(dashboard)/inventori/page.tsx:782-822`): Calculates `resultingStock = item.quantityOnHand + delta`. If `resultingStock < 0`, sets `isNegativeStock = true`, shows error banner ("Penyesuaian tidak valid: Stok akhir tidak boleh kurang dari 0"), and disables the submit button (`disabled={isNegativeStock}`). Validates that delta is non-zero and reason is mandatory (minimum 3 characters).
   - **Debt Repayment Validation** (`apps/web/src/app/(dashboard)/hutang/page.tsx:831-840, 957-964`): Computes `isOverpayment = enteredAmount > debt.remainingBalance`. If `isOverpayment` is true, displays red warning banner, blocks form submission in `onSubmit()`, and disables the submit button (`disabled={isOverpayment}`). Previews live remaining balance and shows "Lunas ✓" badge if resulting balance is 0.
   - **Purchase Completion Modal** (`apps/web/src/app/(dashboard)/belanja/page.tsx:980-1011`): Prompts user with "Transaksi Atomik Terpadu" confirmation dialog, previews item-by-item stock changes (`afterStock = currentStock + quantity`), and generates a unique RFC 4122 v4 UUID (`crypto.randomUUID()`) sent as `idempotency-key` header and body parameter.
   - **RFC 4180 CSV Export** (`apps/web/src/app/(dashboard)/laporan/page.tsx:96-131`): Invokes `/reports/export/csv?type=...`, receives CSV stream text from `apiFetch`, instantiates `Blob([csvText], { type: 'text/csv;charset=utf-8;' })`, triggers browser download, and names the file `laporan-rumahkita-${csvType}-${selectedYear}${...}.csv`.

4. **Empirical Test & Build Execution**:
   - `apps/web/src/__tests__/adversarial-integration.test.ts`: Authored comprehensive 12-test adversarial suite testing BFF proxy forwarding, CSV streaming, 502 gateway error envelope, 400/401/403/422 `ApiClientError` parsing, silent 401 token refresh queue and replay, negative nominal rejection across 4 schemas, stock adjustment constraints, debt overpayment prevention, UUID idempotency key compliance, and CSV export filename generation.
   - `pnpm --filter @rumahkita/web test`:
     ```
     ▶ Adversarial Verification Suite: Milestone 4 Web & BFF
       ✔ forwards query strings, headers, and body payload (69ms)
       ✔ correctly streams CSV content and propagates Content-Disposition header (5ms)
       ✔ returns 502 Bad Gateway with standard error envelope when backend is unreachable (9ms)
       ✔ handles 422 Unprocessable Entity with multiple validation errors (0.4ms)
       ✔ handles 400 Bad Request with array message and fallback details (0.1ms)
       ✔ handles 401 Unauthorized and 403 Forbidden (0.2ms)
       ✔ automatically intercepts 401, calls /api/auth/refresh, updates auth token, and replays request (6ms)
       ✔ rejects negative and zero nominals across income, expense, debt, and payment schemas (2ms)
       ✔ enforces stock adjustment invariants: prevents negative stock and requires valid reason (0.5ms)
       ✔ enforces debt repayment client constraint: rejects payment exceeding remaining balance (0.1ms)
       ✔ verifies purchase completion modal generates valid RFC 4122 v4 UUID and previews stock increment (0.7ms)
       ✔ verifies RFC 4180 CSV export download filename construction and content-type handling (0.1ms)
     ▶ Web API Client & Error Envelope Tests
       ✔ correctly parses structured API error envelopes (0.9ms)
       ✔ handles array message formats seamlessly (0.1ms)
       ✔ handles details fallback when errors array is missing (0.2ms)
     ℹ tests 15 | suites 6 | pass 15 | fail 0 | duration_ms 372ms
     Exited code 0.
     ```
   - `pnpm --filter @rumahkita/web typecheck`: Exited code 0 (`tsc --noEmit`, 0 errors).
   - `pnpm --filter @rumahkita/web lint`: Exited code 0 (`next lint`, "✔ No ESLint warnings or errors").
   - `pnpm --filter @rumahkita/web build`: Exited code 0 (Compiled all 12 routes cleanly, including static generation for `/`, `/_not-found`, `/belanja`, `/dashboard`, `/hutang`, `/inventori`, `/laporan`, `/login`, `/pengaturan`, `/transaksi`, and dynamic handler for `/api/[...path]`).
   - `pnpm turbo run build typecheck test lint`: Exited code 0 across all 8 packages in monorepo scope.

---

## 2. Logic Chain

1. **BFF Proxy Integrity**:
   - *Observation*: `handleProxy` in `apps/web/src/app/api/[...path]/route.ts` extracts incoming headers, query parameters, cookies, and streams the body directly to `BACKEND_API_BASE`.
   - *Empirical Test*: Spinning up a local mock HTTP server and issuing a request to `/api/expenses?page=2&limit=25` verified that the upstream backend receives the exact path, query string, `Authorization`, `X-Household-Id`, `Idempotency-Key`, `Cookie`, and JSON payload.
   - *Failure Path*: When the backend was terminated, `handleProxy` caught the socket error and returned a clean 502 with structured JSON error details without crashing the Next.js process.
   - *Deduction*: The BFF proxy is robust, preserves multi-tenant context, and gracefully handles network partitions.

2. **Error Envelope & Token Lifecycle**:
   - *Observation*: Backend NestJS API returns structured envelopes `{ success: false, statusCode, error, message, errors, details }`.
   - *Empirical Test*: Instantiating `ApiClientError` against 400, 401, 403, and 422 payloads verified that field errors are cleanly mapped to form fields via `getFieldError()`. Mocking a 401 response against `apiFetch` confirmed that the client intercepts 401, calls `/api/auth/refresh`, updates the active token, and replays the original request to return the expected payload.
   - *Deduction*: Frontend error handling is fully aligned with the backend contract and ensures seamless session renewal.

3. **Data Integrity on Client Forms & Modals**:
   - *Observation*: Contracts schemas enforce `.positive()` IDR amounts; UI components feature real-time calculation and validation guards.
   - *Empirical Test*: In `adversarial-integration.test.ts`, negative nominals (-50,000) and zero nominals were rejected across income, expense, debt, and payment schemas. Stock adjustment validation detected negative resulting stock (`quantityOnHand + delta < 0`) and blocked submission. Debt repayment validation detected `enteredAmount > debt.remainingBalance` and blocked submission.
   - *Deduction*: Client-side input validation prevents invalid financial state transitions before requests reach the network.

---

## 3. Caveats

- **End-to-End Browser Automation**: Real DOM rendering in headless browsers, visual regression checking, and cross-browser tap event handling are designated to the `qa-playwright` agent during the QA Phase per project delegation rules (`.agents/AGENTS.md`).
- **Live Database Dependency**: BFF proxy unit and adversarial tests used isolated HTTP mocks and schema validation; full end-to-end integration requires running NestJS backend and PostgreSQL/Redis instances.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 4 (Frontend Web with Next.js App Router) meets and exceeds all robustness and validation criteria:
- BFF proxy correctly forwards query strings, bodies, headers, and cookies, while cleanly streaming CSV exports and returning 502 envelopes on upstream failure.
- `ApiClientError` and `apiFetch` provide complete error parsing and automatic 401 silent token refresh and replay.
- Client form validations prevent negative nominals, negative stock adjustments, and debt overpayments.
- Purchase completion modal enforces atomic confirmation, stock increment previews, and RFC 4122 v4 UUID idempotency keys.
- All 15 tests, TypeScript typechecks, ESLint checks, Next.js production builds, and Turborepo checks pass with zero errors.

---

## 5. Verification Method

To independently verify all claims:

1. **Run Unit and Adversarial Test Suite**:
   ```bash
   pnpm --filter @rumahkita/web test
   ```
   *Expected Result*: Exits 0, 15/15 tests passing.

2. **Run Web App Typecheck**:
   ```bash
   pnpm --filter @rumahkita/web typecheck
   ```
   *Expected Result*: Exits 0, 0 TypeScript errors.

3. **Run Web App Lint**:
   ```bash
   pnpm --filter @rumahkita/web lint
   ```
   *Expected Result*: Exits 0 with "✔ No ESLint warnings or errors".

4. **Run Production Build**:
   ```bash
   pnpm --filter @rumahkita/web build
   ```
   *Expected Result*: Exits 0, compiling all 12 routes cleanly.

5. **Run Monorepo Turbo Check**:
   ```bash
   pnpm turbo run build typecheck test lint
   ```
   *Expected Result*: Exits 0 across all 8 packages in the workspace.
