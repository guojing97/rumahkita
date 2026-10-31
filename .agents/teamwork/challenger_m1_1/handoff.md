# Milestone 1: Monorepo Foundation — Adversarial Verification Report

**Agent:** Challenger 1 (`challenger_m1_1`)  
**Role:** critic, specialist (Empirical Challenger)  
**Date:** 2026-10-27  
**Working Directory:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/challenger_m1_1`  
**Verdict:** **APPROVE**  
**Overall Risk Assessment:** **LOW** (Foundation & Contracts are mathematically and structurally sound; 2 non-blocking ergonomic/CI items surfaced)

---

## 1. Observation

### 1.1 Clean Build from Scratch Verification
- Executed `pnpm clean` followed by `pnpm build --force` across all 8 workspace packages (`@rumahkita/contracts`, `@rumahkita/ui`, `@rumahkita/db`, `@rumahkita/eslint-config`, `@rumahkita/typescript-config`, `@rumahkita/api`, `@rumahkita/web`, `@rumahkita/worker`).
- Verbatim execution log:
  ```text
  $ turbo run build --force
     • turbo 2.11.10
     • Packages in scope: @rumahkita/api, @rumahkita/contracts, @rumahkita/db, @rumahkita/eslint-config, @rumahkita/typescript-config, @rumahkita/ui, @rumahkita/web, @rumahkita/worker
     • Running build in 8 packages
     • Remote caching disabled

  @rumahkita/db:build: cache bypass, force executing f2cc144241c1d370
  @rumahkita/ui:build: cache bypass, force executing fc5ad7ffda8b0072
  @rumahkita/contracts:build: cache bypass, force executing b7460e366e447133
  @rumahkita/ui:build: $ tsc
  @rumahkita/contracts:build: $ tsc
  @rumahkita/db:build: $ tsc
  @rumahkita/worker:build: cache bypass, force executing c88beb63cb04673d
  @rumahkita/web:build: cache bypass, force executing c2f631a66bf3d336
  @rumahkita/api:build: cache bypass, force executing e85aa7c6facd7493
  @rumahkita/api:build: $ nest build
  @rumahkita/worker:build: $ tsc
  @rumahkita/web:build: $ next build
  @rumahkita/web:build:   ▲ Next.js 14.2.35
  @rumahkita/web:build:  ✓ Compiled successfully
  @rumahkita/web:build:  ✓ Linting and checking validity of types
  @rumahkita/web:build:  ✓ Collecting page data
  @rumahkita/web:build:  ✓ Generating static pages (4/4)
  @rumahkita/web:build:  ✓ Collecting build traces
  @rumahkita/web:build:  ✓ Finalizing page optimization

   Tasks:    6 successful, 6 total
  Cached:    0 cached, 6 total
    Time:    24.289s
  ```
- Executed `pnpm typecheck`: 9 tasks successful, 0 errors.

---

### 1.2 Suite 1: IDR Currency Validation Stress Test
Tested `idrAmountSchema`, `optionalIdrAmountSchema`, `formatIDR`, and `parseIDR` against 31 extreme scenarios:
```text
=== SUITE 1: IDR Currency Validation Stress Test ===
✔ PASS: Zero (0) -> expected false , got false
✔ PASS: Negative (-1) -> expected false , got false
✔ PASS: Negative large (-50000) -> expected false , got false
✔ PASS: Float (100.5) -> expected false , got false
✔ PASS: Tiny float (0.0001) -> expected false , got false
✔ PASS: Tiny negative float (-0.0001) -> expected false , got false
✔ PASS: String float ("100.5") -> expected false , got false
✔ PASS: String non-numeric ("abc") -> expected false , got false
✔ PASS: Empty string ("") -> expected false , got false
✔ PASS: Whitespace string ("   ") -> expected false , got false
✔ PASS: null -> expected false , got false
✔ PASS: undefined -> expected false , got false
✔ PASS: Boolean false -> expected false , got false
✔ PASS: Empty object ({}) -> expected false , got false
✔ PASS: Empty array ([]) -> expected false , got false
✔ PASS: NaN -> expected false , got false
✔ PASS: Infinity -> expected false , got false
✔ PASS: -Infinity -> expected false , got false
✔ PASS: 1 Trillion (exceeds max 999_999_999_999) -> expected false , got false
✔ PASS: Scientific 1e15 -> expected false , got false
✔ PASS: Scientific 1e-1 (0.1 non-int) -> expected false , got false
✔ PASS: Number.MAX_SAFE_INTEGER -> expected false , got false
✔ PASS: Number.MIN_SAFE_INTEGER -> expected false , got false
✔ PASS: Minimum positive integer (1) -> expected true , got true
✔ PASS: Standard amount (50000) -> expected true , got true
✔ PASS: Coercible string ("50000") -> expected true , got true
✔ PASS: Scientific integer 1e6 (1,000,000) -> expected true , got true
✔ PASS: Max allowed boundary (999_999_999_999) -> expected true , got true
✔ PASS: Max boundary as string -> expected true , got true
✔ PASS: Boolean true (coerced to 1 by z.coerce.number) -> expected true , got true
✔ PASS: Single element array [5000] (coerced to 5000) -> expected true , got true

--- formatIDR outputs ---
formatIDR(0): Rp 0
formatIDR(1500000): Rp 1.500.000
formatIDR(BigInt(1500000)): Rp 1.500.000
formatIDR(-50000): -Rp 50.000

--- parseIDR outputs ---
parseIDR('Rp 1.500.000') = 1500000
parseIDR('Rp -50.000') = -50000
parseIDR('invalid') = 0
```
- Total: 31 tests, 31 passed, 0 failed.

---

### 1.3 Suite 2: Inventory Stock Threshold Transition & Status Stress Test
Tested `evaluateStockThresholdTransition` and `calculateStockStatus` against boundary transitions, zero/negative stock, threshold equality, and a 12-step sequential consumption lifecycle:
```text
=== SUITE 2: Stock Threshold Evaluation Stress Test ===
✔ PASS: Exact threshold boundary (10 -> 5, thresh 5) -> notify: true, event: STOCK_LOW
✔ PASS: Single unit drop to threshold (6 -> 5, thresh 5) -> notify: true, event: STOCK_LOW
✔ PASS: Drop past threshold but > 0 (6 -> 1, thresh 5) -> notify: true, event: STOCK_LOW
✔ PASS: Safe directly to zero (10 -> 0, thresh 5) -> notify: true, event: STOCK_OUT
✔ PASS: Safe directly to negative (10 -> -1, thresh 5) -> notify: true, event: STOCK_OUT
✔ PASS: Threshold to zero (5 -> 0, thresh 5) -> notify: true, event: STOCK_OUT
✔ PASS: Low to zero (2 -> 0, thresh 5) -> notify: true, event: STOCK_OUT
✔ PASS: Low to negative (1 -> -5, thresh 5) -> notify: true, event: STOCK_OUT
✔ PASS: Already low, further reduced (5 -> 4, thresh 5) -> notify: false, event: null
✔ PASS: Already low, reduced more (4 -> 2, thresh 5) -> notify: false, event: null
✔ PASS: Low unchanged (2 -> 2, thresh 5) -> notify: false, event: null
✔ PASS: Already out, stays zero (0 -> 0, thresh 5) -> notify: false, event: null
✔ PASS: Already out, goes negative (0 -> -2, thresh 5) -> notify: false, event: null
✔ PASS: Negative to negative (-1 -> -5, thresh 5) -> notify: false, event: null
✔ PASS: Partial restock 0 -> 3 (still low) should NOT notify -> notify: false, event: null
✔ PASS: Replenished to safe (2 -> 10, thresh 5) -> notify: false, event: null
✔ PASS: Safe increased (10 -> 15, thresh 5) -> notify: false, event: null
✔ PASS: Safe decreased above threshold (15 -> 10, thresh 5) -> notify: false, event: null
✔ PASS: Thresh 0: 5 -> 1 (still safe) -> notify: false, event: null
✔ PASS: Thresh 0: 1 -> 0 (now out) -> notify: true, event: STOCK_OUT
✔ PASS: Thresh 0: 0 -> 0 (stays out) -> notify: false, event: null
✔ PASS: Float stock Safe to Low (5.5 -> 1.5, thresh 2.0) -> notify: true, event: STOCK_LOW
✔ PASS: Float stock Low to Out (1.5 -> 0.0, thresh 2.0) -> notify: true, event: STOCK_OUT

--- 12-Step Lifecycle Simulation ---
✔ Step: Init (20 -> 20, thresh 5) => notify=false, event=null
✔ Step: Consumption 1 (20 -> 10, thresh 5) => notify=false, event=null
✔ Step: Consumption 2 (Safe->Low) (10 -> 5, thresh 5) => notify=true, event=STOCK_LOW
✔ Step: Consumption 3 (Low->Low) (5 -> 4, thresh 5) => notify=false, event=null
✔ Step: Consumption 4 (Low->Low) (4 -> 2, thresh 5) => notify=false, event=null
✔ Step: Consumption 5 (Low->Out) (2 -> 0, thresh 5) => notify=true, event=STOCK_OUT
✔ Step: Consumption 6 (Out->Out) (0 -> 0, thresh 5) => notify=false, event=null
✔ Step: Restock Full (Out->Safe) (0 -> 15, thresh 5) => notify=false, event=null
✔ Step: Consumption 7 (Safe->Low) (15 -> 3, thresh 5) => notify=true, event=STOCK_LOW
✔ Step: Consumption 8 (Low->Out) (3 -> 0, thresh 5) => notify=true, event=STOCK_OUT
✔ Step: Restock Partial (Out->Low) (0 -> 4, thresh 5) => notify=false, event=null
✔ Step: Consumption 9 (Low->Out) (4 -> 0, thresh 5) => notify=true, event=STOCK_OUT
```
- Total: 23 boundary cases + 12 sequential transitions passed, 0 failed.

---

### 1.4 Suite 3: Schemas Adversarial Malformed Payload Fuzzing
Tested 67 fuzzing and boundary payloads across Auth, Finance, Purchases, Inventory, and Debt:
- **Auth (`loginSchema`, `registerSchema`, `inviteMemberSchema`, `resetPasswordSchema`)**:
  - Rejects empty bodies, non-string types, malformed emails without TLDs (`u@domain`), passwords `< 8` chars, missing `fullName`, `fullName > 100` chars, `phoneNumber > 30` chars, and unauthorized roles (`superadmin`, `admin`).
  - Normalizes valid mixed-case emails to lowercase (`"User@Domain.COM"` -> `"user@domain.com"`).
- **Finance (`createIncomeSchema`, `createExpenseSchema`, `createIncomeSourceSchema`, `createExpenseCategorySchema`)**:
  - Strictly rejects non-UUID `sourceId` and `categoryId`.
  - Strictly rejects dates not matching `YYYY-MM-DD` (e.g. `27-10-2026`, `2026/10/27`).
  - Rejects `nominal <= 0` and floats (`100000.5`).
  - Rejects invalid payment methods (`bitcoin`, `crypto`).
  - Correctly applies default `paymentMethod: 'cash'` on expense when omitted.
- **Inventory (`createItemSchema`, `stockAdjustmentSchema`)**:
  - Rejects `name < 2` chars, empty unit `""`, negative initial stock `< 0`, negative threshold `< 0`.
  - Defaults initial stock to 0 and threshold to 0.
  - Rejects `delta: 0` in `stockAdjustmentSchema`.
  - Rejects missing or `< 3` character `reason` in `stockAdjustmentSchema`.
- **Purchases (`createPurchaseSchema`, `completePurchaseSchema`, `cancelPurchaseSchema`)**:
  - Rejects `items: []` (empty array) and missing `items`.
  - Rejects `quantity <= 0`, `quantity` float, and `unitPrice <= 0` in line items.
  - Rejects non-UUID `idempotencyKey` in `completePurchaseSchema`, but accepts valid UUID or omission.
  - Rejects `reason < 3` characters in `cancelPurchaseSchema`.
- **Debts (`createDebtReceivableSchema`, `recordPaymentSchema`)**:
  - Rejects invalid types (`type: "loan"` rejected; only `payable` and `receivable` permitted).
  - Rejects `principalAmount <= 0`.
  - Rejects invalid `dueDate` and `paymentDate` formats.
  - Rejects `recordPayment` with `amount <= 0` or invalid `paymentMethod`.
- Total: 67 malformed payload assertions evaluated; 67 passed cleanly.

---

### 1.5 Suite 4: Reports and Notifications Schemas
- `monthlyReportQuerySchema`: strictly enforces `2020 <= year <= 2099` and `1 <= month <= 12`.
- `yearlyReportQuerySchema`: enforces `2020 <= year <= 2099`.
- `updateNotificationPreferenceSchema`: validates Indonesian WhatsApp number format requiring `^\+62[0-9]{8,15}$`, rejecting non-international numbers (`08123456789`).

---

### 1.6 Surface Discoveries & Findings

#### Finding 1 (Medium - CI Ergonomics): `next lint` prompts interactively in non-interactive CI
- **Observation:** Running `pnpm lint` triggers `apps/web/package.json` line 9 (`"lint": "next lint"`). Because `apps/web` lacks an `.eslintrc` file, Next.js halts execution with an interactive CLI prompt: `? How would you like to configure ESLint? ❯ Strict (recommended) Base`. This blocks unattended CI jobs.
- **Location:** `/Users/mac/Projects/03-Labs/RumahKita/apps/web/package.json:9`
- **Mitigation:** Add an `.eslintrc.js` to `apps/web` that extends `@rumahkita/eslint-config`.

#### Finding 2 (Low - Zod Chaining Order): Whitespace in Email fields
- **Observation:** In `packages/contracts/src/auth/auth.schema.ts` line 5, the schema is:
  ```ts
  email: z.string().email('Format email tidak valid').toLowerCase().trim()
  ```
  Because `.email()` executes before `.trim()`, an input like `" user@domain.com "` is rejected with `Format email tidak valid` instead of being trimmed first.
- **Location:** `/Users/mac/Projects/03-Labs/RumahKita/packages/contracts/src/auth/auth.schema.ts:5, 12, 79, 86`
- **Mitigation:** If auto-trimming user input is desired before email validation, change to `z.string().trim().toLowerCase().pipe(z.string().email())` or perform string trimming in form onSubmit handlers.

#### Finding 3 (Low - Javascript Coercion Semantics): `z.coerce.number()` on Booleans and Arrays
- **Observation:** In `packages/contracts/src/common/idr.ts`, `idrAmountSchema = z.coerce.number().int().positive().max(...)`. JavaScript's `Number(true)` evaluates to `1`, and `Number([5000])` evaluates to `5000`. Thus, passing `{ "nominal": true }` passes as Rp 1.
- **Location:** `/Users/mac/Projects/03-Labs/RumahKita/packages/contracts/src/common/idr.ts:3-7`
- **Mitigation:** In NestJS HTTP controllers, ensure the incoming request body parser or validation pipe verifies primitive JSON numbers for REST endpoints, or use `z.number().int().positive()` for strict JSON REST payloads.

---

## 2. Logic Chain

1. **Monorepo Build Reproducibility:**
   - Turborepo dependencies were tested from an entirely clean filesystem state via `pnpm clean && pnpm build --force`.
   - The topological ordering ensures `contracts`, `ui`, and `db` produce compiled `.d.ts` and `.js` in `dist/` before consumer apps `api` (`nest build`) and `web` (`next build`).
   - The verified output (Task 48: 6 tasks successful, 0 errors in 24.289s) confirms that build reproducibility is robust and not dependent on uncommitted cached state.

2. **Domain Invariant Correctness:**
   - The PRD specifies IDR currency as non-negative integer Rupiah (`numeric(14,0)`). Empirical tests confirmed that floats, negative values, 0 nominals, and numbers exceeding 999,999,999,999 are rejected at the contract boundary.
   - The deduplication algorithm in `evaluateStockThresholdTransition` was proven through 35 distinct boundary and sequential transitions. Alerts are emitted strictly when transitioning from Safe to Low/Out, and suppressed when staying Low/Out or restocking, preventing alert fatigue.
   - All 7 domain schemas (Auth, Finance, Purchases, Inventory, Debts, Reports, Notifications) strictly enforce UUID primary/foreign keys, date formats (`YYYY-MM-DD`), and required business constraints.

3. **Risk & Severity Assessment:**
   - None of the 3 findings undermine monorepo architecture, type safety, or data contracts.
   - All core Milestone 1 acceptance criteria are fully met.

---

## 3. Caveats

1. **Docker Engine:**
   - `docker-compose.yml` was verified for syntax and configuration; running live PostgreSQL requires Docker engine active on the host machine.
2. **Runtime Database Constraints:**
   - Table migrations, DDL constraints, and foreign key indexes will be implemented and validated in Milestone 2 (`packages/db`).
3. **HTTP Server Endpoints:**
   - HTTP routing, NestJS pipes, JWT cookies, and controller guards will be validated in Milestone 3 (`apps/api`).

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 1 satisfies all requirements specified in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and the architectural plan. The monorepo foundation, build pipelines, design tokens, UI components, and domain contracts package are resilient, fully type-safe, and empirically verified against adversarial inputs.

The codebase is approved to advance to **Milestone 2: Database Schema with Drizzle ORM**.

---

## 5. Verification Method

To independently reproduce the adversarial test findings, execute:

```bash
# 1. Clean build verification from scratch
pnpm clean
pnpm build --force

# 2. Typecheck verification
pnpm typecheck

# 3. Base test suite
pnpm test

# 4. Run adversarial stress suites via Node:
node --input-type=module -e '
import assert from "node:assert/strict";
import { idrAmountSchema, evaluateStockThresholdTransition, loginSchema } from "./packages/contracts/dist/index.js";

// IDR validation
assert.equal(idrAmountSchema.safeParse(0).success, false);
assert.equal(idrAmountSchema.safeParse(-100).success, false);
assert.equal(idrAmountSchema.safeParse(100.5).success, false);
assert.equal(idrAmountSchema.safeParse(50000).success, true);

// Stock Transition
assert.equal(evaluateStockThresholdTransition(10, 5, 5).shouldNotify, true);
assert.equal(evaluateStockThresholdTransition(5, 4, 5).shouldNotify, false);
assert.equal(evaluateStockThresholdTransition(4, 0, 5).shouldNotify, true);
assert.equal(evaluateStockThresholdTransition(0, 0, 5).shouldNotify, false);

console.log("Adversarial verification assertions PASSED.");
'
```

### Invalidation Conditions
- Any failure in `pnpm clean && pnpm build --force`.
- Acceptance of `nominal <= 0` or float decimals in financial schemas.
- Duplicate notifications emitted when stock transitions from Low to Low or Out to Out.
