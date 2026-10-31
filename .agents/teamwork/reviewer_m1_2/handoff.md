# Milestone 1: Monorepo Foundation — Review & Adversarial Audit Report

**Reviewer:** Reviewer 2 (`reviewer_m1_2`)  
**Roles:** Reviewer, Adversarial Critic  
**Working Directory:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/reviewer_m1_2`  
**Verdict:** `REQUEST_CHANGES`  
**Date:** 2026-10-27  

---

## Review Summary

- **Verdict:** `REQUEST_CHANGES`
- **Integrity Attestation:** **PASS**. No integrity violations, hardcoded test falsifications, dummy facades, or shortcuts detected. Implementation of the monorepo foundation, Neo-brutalism design system, contracts, Docker compose, and app skeletons is genuine.
- **Key Blockers:**
  1. `pnpm lint` hangs Monorepo CI/CLI interactively because `apps/web` has no ESLint configuration, and `packages/eslint-config` lacks dependencies and wiring across packages.
  2. `optionalIdrAmountSchema` coerces `null` to `0`, causing nullable currency inputs (e.g., clearing `budgetLimit` in expense categories) to inadvertently set a `0` IDR budget limit rather than unsetting it.
  3. `parseIDR` decimal parsing flaw treats `Rp 150.000,00` as `15.000.000` (100x inflation).

---

## 1. Observation

### 1.1 Direct Observations & Verbatim Command Outputs

#### 1. Dependency Resolution (`pnpm install`)
- **Command:** `pnpm install`
- **Result:** Exited 0.
- **Output:**
  ```text
  Scope: all 9 workspace projects
  Already up to date
  Done in 444ms using pnpm v11.25.0
  ```

#### 2. Cold Build Execution (`pnpm build --force`)
- **Command:** `pnpm build --force` (`turbo run build --force`)
- **Result:** Exited 0 in 17.081s without caching. All 6 tasks (`@rumahkita/ui:build`, `@rumahkita/contracts:build`, `@rumahkita/db:build`, `@rumahkita/api:build`, `@rumahkita/web:build`, `@rumahkita/worker:build`) succeeded.
- **Output:**
  ```text
  Tasks:    6 successful, 6 total
  Cached:   0 cached, 6 total
  Time:     17.081s
  ```

#### 3. TypeScript Typechecking (`pnpm turbo run typecheck --force`)
- **Command:** `pnpm turbo run typecheck --force`
- **Result:** Exited 0 in 8.672s.
- **Output:**
  ```text
  Tasks:    9 successful, 9 total
  Cached:   0 cached, 9 total
  Time:     8.672s
  ```

#### 4. Automated Tests (`pnpm turbo run test --force`)
- **Command:** `pnpm turbo run test --force`
- **Result:** Exited 0. 15 unit tests passed across 5 test suites.
- **Output:**
  ```text
  ✔ Contracts & Domain Logic Tests (133.294842ms)
  ℹ tests 15
  ℹ suites 5
  ℹ pass 15
  ℹ fail 0
  ```

#### 5. Lint Command Execution (`pnpm lint`)
- **Command:** `pnpm lint` (`turbo run lint`)
- **Result:** **FAILED / HANGS**.
- **Output:**
  ```text
  @rumahkita/web:lint: cache miss, executing a11f540abfa818c7
  @rumahkita/web:lint: $ next lint
  @rumahkita/web:lint: ? How would you like to configure ESLint? https://nextjs.org/docs/basic-features/eslint
  @rumahkita/web:lint: ❯  Strict (recommended)
  @rumahkita/web:lint:    Base
  ```
  Process hung waiting for interactive TTY input and had to be terminated.

#### 6. Concurrent Development Boot (`pnpm dev`)
- **Command:** `pnpm dev` (`turbo run dev`)
- **Result:** Successfully spawned all three applications concurrently:
  - `@rumahkita/web:dev`: Next.js 14.2.14 ready on `http://localhost:3000`
  - `@rumahkita/api:dev`: NestJS ready on `http://localhost:4000/api/v1` and Swagger on `/api/docs`
  - `@rumahkita/worker:dev`: Notification daemon started polling at 5000ms

---

## 2. Findings

### [Major] Finding 1: `pnpm lint` Hangs Interactive Prompt and Fails Non-Interactive Monorepo CI

- **What:** Running `pnpm lint` causes `@rumahkita/web` to prompt interactively (`? How would you like to configure ESLint?`), blocking CI/CD pipelines indefinitely.
- **Where:** 
  - `apps/web/package.json:9` (`"lint": "next lint"`)
  - `packages/eslint-config/package.json:1-10`
  - Monorepo root `turbo.json:26-28`
- **Why:** 
  1. `apps/web` has no `.eslintrc.js` or `.eslintrc.json`.
  2. `packages/eslint-config/package.json` specifies zero dependencies (missing `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint`, `eslint-config-prettier`).
  3. No workspace packages declare a dependency on `@rumahkita/eslint-config`.
- **Suggestion:**
  1. Add dependencies to `packages/eslint-config/package.json`:
     ```json
     "peerDependencies": {
       "eslint": ">=8.0.0"
     },
     "dependencies": {
       "@typescript-eslint/eslint-plugin": "^8.0.0",
       "@typescript-eslint/parser": "^8.0.0",
       "eslint-config-prettier": "^9.1.0"
     }
     ```
  2. Add `.eslintrc.cjs` to `apps/web` extending `next/core-web-vitals` or `@rumahkita/eslint-config`.
  3. Add `lint` scripts to `apps/api` and `apps/worker` so `turbo run lint` covers the entire workspace non-interactively.

---

### [Major] Finding 2: `optionalIdrAmountSchema` Coerces `null` to `0` IDR for Nullable Fields

- **What:** `optionalIdrAmountSchema` coerces `null` into the number `0` instead of `null` or `undefined`.
- **Where:** 
  - `packages/contracts/src/common/idr.ts:9-14`
  - `packages/contracts/src/finance/category.schema.ts:36,45` (`budgetLimit: optionalIdrAmountSchema`)
- **Why:** In JavaScript, `Number(null)` evaluates to `0`. If a user or frontend submits `{ budgetLimit: null }` to remove an expense category budget limit, `createExpenseCategorySchema.safeParse({ name: "Makan", budgetLimit: null })` yields `{ success: true, data: { name: "Makan", budgetLimit: 0 } }`. A budget limit of 0 Rupiah will cause every expense to immediately flag an exceeded budget alert.
- **Suggestion:**
  Update `packages/contracts/src/common/idr.ts`:
  ```typescript
  export const optionalIdrAmountSchema = z.preprocess(
    (val) => (val === null || val === '' || val === undefined ? undefined : val),
    z.coerce
      .number()
      .int('Nominal harus berupa bilangan bulat')
      .min(0, 'Nominal tidak boleh negatif')
      .max(999_999_999_999, 'Nominal melebihi batas wajar')
      .optional()
  );
  ```
  Or allow explicit nullable support: `z.union([z.null(), ...]).optional()`.

---

### [Minor] Finding 3: `parseIDR` Inflates Decimal Values 100x on Indonesian Standard Currency Strings

- **What:** `parseIDR("Rp 150.000,00")` parses to `15000000` (15 million) instead of `150000` (150 thousand).
- **Where:** `packages/contracts/src/common/idr.ts:25-29`
- **Why:** `formatted.replace(/[^0-9-]/g, '')` strips the comma `,` and treats `,00` as two additional zeros, multiplying the amount by 100.
- **Suggestion:**
  Strip `,00` or decimal cents before stripping non-digits:
  ```typescript
  export function parseIDR(formatted: string): number {
    const cleaned = formatted.replace(/,\d{2}$/, '').replace(/[^0-9-]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  ```

---

### [Minor] Finding 4: Stock Adjustment Reason Bypassed by Whitespace-Only Strings

- **What:** `stockAdjustmentSchema.safeParse({ delta: 5, reason: "   " })` returns `success: true`.
- **Where:** `packages/contracts/src/inventory/stock-movement.schema.ts:24`
- **Why:** `z.string().min(3)` counts spaces. PRD requires a mandatory reason for stock adjustments.
- **Suggestion:**
  Add `.trim()` to the reason field:
  ```typescript
  reason: z.string().trim().min(3, 'Alasan penyesuaian stok wajib diisi minimal 3 karakter').max(500),
  ```

---

### [Minor] Finding 5: `idrAmountSchema` Coerces Boolean `true` to `1` IDR

- **What:** `idrAmountSchema.safeParse(true)` succeeds with `data: 1`.
- **Where:** `packages/contracts/src/common/idr.ts:3-7`
- **Why:** `z.coerce.number()` converts boolean `true` to `1`.
- **Suggestion:**
  Disallow booleans in preprocessing:
  ```typescript
  export const idrAmountSchema = z.preprocess(
    (val) => (typeof val === 'boolean' ? NaN : val),
    z.coerce.number().int('Nominal harus berupa bilangan bulat').positive('Nominal harus lebih dari 0').max(999_999_999_999)
  );
  ```

---

### [Minor] Finding 6: Turborepo Test Output Warning on `pnpm test`

- **What:** Running `turbo run test` produces `WARNING no output files found for task @rumahkita/contracts#test`.
- **Where:** `turbo.json:34` (`"outputs": ["coverage/**"]`)
- **Why:** `node --test` in `@rumahkita/contracts` executes without coverage generation flags, so no `coverage/` directory is created.
- **Suggestion:** Remove `"outputs": ["coverage/**"]` or specify `"outputs": []` in `turbo.json` under `test`.

---

## 3. Verified Claims

| # | Worker Claim | Verification Method | Status | Notes |
|---|--------------|---------------------|--------|-------|
| 1 | `pnpm install` succeeds cleanly | Ran `pnpm install` in repo root | PASS | Completed in 444ms |
| 2 | `pnpm build` builds all 8 packages | Ran `pnpm build --force` | PASS | 6 build targets succeeded from cold cache in 17.08s |
| 3 | `pnpm typecheck` passes with zero errors | Ran `pnpm turbo run typecheck --force` | PASS | All 9 typecheck tasks succeeded in 8.67s |
| 4 | `pnpm test` runs 15 domain tests | Ran `pnpm turbo run test --force` | PASS | 15 tests passed across 5 suites |
| 5 | `pnpm dev` boots all 3 apps concurrently | Ran `pnpm dev` and monitored startup logs | PASS | Web on 3000, API on 4000, Worker loop started |
| 6 | Neo-brutalism design tokens and components | Inspected `packages/ui` CSS and React components | PASS | Follows design spec §2 tokens, shadows, and radii |
| 7 | Shared contracts cover all PRD domains | Inspected `packages/contracts/src` | PASS | Auth, Finance, Inventory, Purchases, Debts, Reports, Notifications exported |
| 8 | Shared ESLint tooling is operational | Executed `pnpm lint` | **FAIL** | Interactive prompt blocks non-interactive execution |

---

## 4. Adversarial Stress-Testing & Attack Surface Analysis

### 4.1 Stock Transition Deduplication State Matrix
Tested `evaluateStockThresholdTransition(prev, curr, thresh)` across boundary scenarios:
- `5 -> 2` (Threshold 2): Returns `{ shouldNotify: true, eventType: 'STOCK_LOW' }` (PASS)
- `5 -> 0` (Threshold 2): Returns `{ shouldNotify: true, eventType: 'STOCK_OUT' }` (PASS)
- `2 -> 1` (Threshold 2): Returns `{ shouldNotify: false, eventType: null }` (PASS - Duplicate alert suppressed)
- `1 -> 5` (Threshold 2): Returns `{ shouldNotify: false, eventType: null }` (PASS - Replenishment suppressed)
- `0 -> 0` (Threshold 2): Returns `{ shouldNotify: false, eventType: null }` (PASS)

### 4.2 UUID & Date Injection Edge Cases
- Invalid UUID strings (`"not-a-uuid"`, `""`): Correctly rejected with validation errors.
- Non-conforming date strings (`"27-10-2026"`, `"2026-10-27T00:00:00Z"`): Correctly rejected.
- Calendar-invalid dates (`"2026-02-31"`, `"2026-99-99"`): Accepted by format regex `^\d{4}-\d{2}-\d{2}$`. Backend services in Milestone 3 must parse through strict calendar date constructors before persisting.

---

## 5. Integrity Check Attestation

- **Hardcoded test shortcuts:** NONE. All tests use genuine assertions against dynamic parsers.
- **Dummy/Facade implementations:** NONE. Skeletons for `api`, `web`, `worker`, `db`, and `ui` are bona fide monorepo structural baselines satisfying Milestone 1.
- **Verification tampering:** NONE. All logs and results were reproduced and verified independently.

---

## 6. Logic Chain

1. **Premise:** Milestone 1 requires establishing a reliable monorepo workspace toolchain (`build`, `dev`, `lint`, `typecheck`, `test`), shared contracts, design system tokens, and Docker environment.
2. **Observation:** Running `pnpm lint` in the monorepo fails to run non-interactively and hangs on `apps/web` due to unconfigured ESLint files and missing dependencies in `packages/eslint-config`.
3. **Observation:** Passing `{ budgetLimit: null }` to `createExpenseCategorySchema` coerces `null` to `0` IDR because `optionalIdrAmountSchema` uses `z.coerce.number().min(0)`.
4. **Observation:** `parseIDR("Rp 150.000,00")` parses into `15000000` due to naive digit replacement.
5. **Deduction:** Because linting fails in standard CI mode, and monetary contract schemas have silent numeric mutation bugs for nullable amounts, the work cannot be approved without changes.
6. **Conclusion:** Issue `REQUEST_CHANGES` with clear recommendations for Worker 1 to address these specific issues before progressing to Milestone 2.

---

## 7. Caveats

- **Docker Container Daemon:** Docker Compose was validated syntactically and structurally; live PostgreSQL database container startup and schema migrations are the direct scope of Milestone 2.
- **Calendar Date Parsing:** The regex in contracts tests date syntax (`YYYY-MM-DD`); actual calendar validation (e.g. leap years, valid day-of-month) is deferred to runtime database insertion or can be added to Zod refines.

---

## 8. Conclusion & Actionable Next Steps for Worker 1

**Verdict:** `REQUEST_CHANGES`

### Required Fixes:
1. **Fix Monorepo ESLint & `pnpm lint`:**
   - Add necessary dependencies to `packages/eslint-config/package.json`.
   - Add `.eslintrc.cjs` or `.eslintrc.json` in `apps/web`.
   - Ensure `pnpm lint` executes non-interactively and exits 0 across the monorepo.
2. **Fix `optionalIdrAmountSchema` in `packages/contracts`:**
   - Prevent `null` from being coerced to `0` (ensure `null` or `undefined` remains unset/null).
3. **Fix `parseIDR` in `packages/contracts`:**
   - Handle `,00` decimal fractions without 100x inflation.
4. **Harden `stockAdjustmentSchema.reason`:**
   - Add `.trim()` to prevent whitespace-only reasons.
5. **Clean up `turbo.json` outputs for `test`:**
   - Prevent empty output directory warning during test runs.

---

## 9. Verification Method

Once Worker 1 applies the fixes, run the following verification suite:

```bash
# 1. Clean verify dependencies
pnpm install

# 2. Verify ESLint runs non-interactively and passes
pnpm lint

# 3. Verify contracts test suite passes with edge cases
pnpm --filter @rumahkita/contracts test

# 4. Verify all builds and typechecks pass
pnpm build --force
pnpm turbo run typecheck --force
```
