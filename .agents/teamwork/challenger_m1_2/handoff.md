# Milestone 1: Monorepo Foundation — Adversarial Verification Report

**Challenger:** Challenger 2 (`challenger_m1_2`)  
**Roles:** Critic, Empirical Challenger, Specialist  
**Working Directory:** `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/challenger_m1_2`  
**Verdict:** `REJECT` (Milestone 1 Gates Pending Fixes)  
**Date:** 2026-10-27  

---

## Challenge Summary

- **Overall Risk Assessment:** `HIGH`
- **Explicit Verdict:** `REJECT`
- **Core Verification Summary:**
  1. **Dependency Graph & Topological Builds:** **PASS**. Zero circular dependencies across all 8 workspace packages and applications. Clean acyclic DAG resolved with topological ordering (`eslint-config`, `typescript-config` -> `contracts`, `ui`, `db` -> `web`, `api`, `worker`). Full cold compilation (`pnpm turbo run build --force`) executes in 31s with 0 errors.
  2. **Neo-brutalism Design Tokens & Styles:** **PASS on tokens/shadows**, but **FAIL on WCAG AA Contrast**. Zero blurred shadows (`0` blur radius on all 5 shadow levels). Zero generic AI slop styles (no `rounded-full` pills, no gradients, no `backdrop-blur`). However, mathematical WCAG 2.1 evaluation reveals that `Badge` (`variant="aman"`) fails WCAG AA contrast for normal text (4.17:1 < 4.5:1 required).
  3. **DTO Edge Case Fuzzing:** **FAIL on 3 edge cases**.
     - **Email Whitespace Rejection (Zod Chaining Bug):** `loginSchema`, `registerSchema`, `inviteMemberSchema`, and `forgotPasswordSchema` use `.email().toLowerCase().trim()`. In Zod, `.email()` runs first on the raw string and rejects any input containing whitespace, leaving `.trim()` completely dead/inert.
     - **IDR Parsing 100x Inflation:** `parseIDR("Rp 150.000,00")` parses to `150000000` (150 million instead of 1.5 million) because stripping non-digits keeps decimal `,00` as two zeros.
     - **Schema Coercion Quirks:** `idrAmountSchema` coerces `true` to `1` IDR and `[100]` to `100` IDR.

---

## 1. Observation

### 1.1 Package Dependency Graph and Topological Build Execution

#### Observation 1.1.1: Dependency Graph Analysis
Adjacency analysis of all workspace `package.json` manifests (`packages/*`, `apps/*`):
```text
@rumahkita/contracts (packages/contracts)       -> [@rumahkita/typescript-config]
@rumahkita/ui (packages/ui)                     -> [@rumahkita/typescript-config]
@rumahkita/db (packages/db)                     -> [@rumahkita/typescript-config]
@rumahkita/eslint-config (packages/eslint-config)-> []
@rumahkita/typescript-config                   -> []
@rumahkita/api (apps/api)                       -> [@rumahkita/contracts, @rumahkita/db, @rumahkita/typescript-config]
@rumahkita/web (apps/web)                       -> [@rumahkita/contracts, @rumahkita/ui, @rumahkita/typescript-config]
@rumahkita/worker (apps/worker)                 -> [@rumahkita/contracts, @rumahkita/db, @rumahkita/typescript-config]
```
- DFS cycle detector: 0 cycles detected across all 8 packages.
- Architectural boundary check: 0 shared packages depend on application packages (`apps/*`).
- Topological build order:
  `1. @rumahkita/eslint-config`  
  `2. @rumahkita/typescript-config`  
  `3. @rumahkita/contracts`  
  `4. @rumahkita/ui`  
  `5. @rumahkita/db`  
  `6. @rumahkita/web`  
  `7. @rumahkita/api`  
  `8. @rumahkita/worker`  

#### Observation 1.1.2: Turbo Clean Force Build
Executing `pnpm turbo run build --force`:
```text
Tasks:    6 successful, 6 total
Cached:   0 cached, 6 total
Time:     31.263s
```
All targets (`@rumahkita/contracts`, `@rumahkita/ui`, `@rumahkita/db`, `@rumahkita/worker`, `@rumahkita/api`, `@rumahkita/web`) compiled from source with 0 errors.

---

### 1.2 Neo-Brutalism Design Tokens & WCAG AA Contrast Ratios

#### Observation 1.2.1: Hard Shadows and Absence of AI Slop
Inspected `packages/ui/src/tokens/neo-brutalism.css`, `packages/ui/src/preset.ts`, and `apps/web/src/app/globals.css`:
- Hard shadows with zero blur:
  - `--shadow-sm: 2px 2px 0 var(--ink);`
  - `--shadow-base: 4px 4px 0 var(--ink);`
  - `--shadow-hover: 5px 5px 0 var(--ink);`
  - `--shadow-lg: 6px 6px 0 var(--ink);`
  - `--shadow-active: 2px 2px 0 var(--ink);`
- Grep across `packages/ui/src` and `apps/web/src` for `rounded-full`, `gradient`, and `backdrop-blur`: 0 matches found.
- Border widths are strictly 2px `--ink` (`border-neo`), radii are 6px-12px (no pill buttons/cards), typography uses `Space Grotesk` and `Inter`, and financial numbers use `tabular-nums`.

#### Observation 1.2.2: WCAG 2.1 AA Contrast Ratio Calculations
Evaluated using the official WCAG relative luminance formula via `contrast-check.py` (`/Users/mac/.gemini/config/skills/antislop-human/contrast-check.py`):
```text
=== WCAG AA Contrast Ratios Evaluation ===
[PASS] Body text (ink on bg)                               : 17.62:1 (Min: 4.5:1)
[PASS] Body text (ink on surface)                          : 17.93:1 (Min: 4.5:1)
[PASS] Muted text on bg                                    : 5.81:1  (Min: 4.5:1)
[PASS] Muted text on surface                               : 5.91:1  (Min: 4.5:1)
[PASS] Primary Button (ink on primary)                     : 13.87:1 (Min: 4.5:1)
[PASS] Secondary Button (ink on surface)                   : 17.93:1 (Min: 4.5:1)
[PASS] Destructive Button (white on danger)                : 6.57:1  (Min: 4.5:1)
[FAIL] Badge Aman (success on success 15% over surface)    : 4.17:1  (Min: 4.5:1)
[FAIL] Badge Aman (success on success 15% over bg)         : 4.10:1  (Min: 4.5:1)
[PASS] Badge Menipis (warning on warning 15% over surface) : 4.56:1  (Min: 4.5:1)
[FAIL] Badge Menipis (warning on warning 15% over bg)      : 4.48:1  (Min: 4.5:1)
[PASS] Badge Habis (danger on danger 15% over surface)     : 5.11:1  (Min: 4.5:1)
[PASS] Badge Primary (ink on primary)                      : 13.87:1 (Min: 4.5:1)
[PASS] Badge Secondary (ink on secondary)                  : 12.32:1 (Min: 4.5:1)
[PASS] Badge Neutral (ink on surface)                      : 17.93:1 (Min: 4.5:1)
```
- In `packages/ui/src/components/badge.tsx:16`:
  `aman: 'bg-success/15 text-success border-success font-semibold'`
  Text size is `text-xs` (12px = normal text, requiring 4.5:1).
  `--success` is `#287D4F`. `bg-success/15` blended over `#FFFFFF` is `#DFECE5`.
  `python3 contrast-check.py 287D4F DFECE5`:
  ```text
  ratio: 4.17:1
  normal text (4.5:1): FAIL
  large text  (3.0:1): PASS
  ```
- In `packages/ui/src/components/badge.tsx:17`:
  `menipis: 'bg-warning/15 text-warning border-warning font-semibold'`
  When rendered over page background `--bg` (`#FFFDF7`), the blended background is `#F0E4D2`.
  `python3 contrast-check.py 9A5700 F0E4D2`:
  ```text
  ratio: 4.48:1
  normal text (4.5:1): FAIL
  large text  (3.0:1): PASS
  ```

---

### 1.3 DTO Edge Case Fuzzing

#### Observation 1.3.1: Zod Chaining Bug in Auth Schemas
In `packages/contracts/src/auth/auth.schema.ts`:
- Line 5 (`loginSchema`): `email: z.string().email('Format email tidak valid').toLowerCase().trim()`
- Line 12 (`registerSchema`): `email: z.string().email('Format email tidak valid').toLowerCase().trim()`
- Line 79 (`inviteMemberSchema`): `email: z.string().email('Format email tidak valid').toLowerCase().trim()`
- Line 86 (`forgotPasswordSchema`): `email: z.string().email('Format email tidak valid').toLowerCase().trim()`

Executing:
```js
contracts.loginSchema.safeParse({ email: "  user@example.com  ", password: "Password123!" })
```
Result:
```json
{
  "success": false,
  "error": [
    {
      "validation": "email",
      "code": "invalid_string",
      "message": "Format email tidak valid",
      "path": ["email"]
    }
  ]
}
```
Validation fails because `z.string().email()` executes on the raw string before `.trim()`.

#### Observation 1.3.2: 100x Nominal Inflation in `parseIDR`
In `packages/contracts/src/common/idr.ts:25-29`:
```typescript
export function parseIDR(formatted: string): number {
  const cleaned = formatted.replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}
```
Executing:
```js
contracts.parseIDR("Rp 1.500.000,00")
```
Result:
```text
150000000
```
`150000000` (150 million IDR instead of 1.5 million IDR). The function strips `,` and keeps `00`, multiplying the nominal amount by 100.

#### Observation 1.3.3: Inappropriate Type Coercion in `idrAmountSchema`
In `packages/contracts/src/common/idr.ts:3-7`:
```typescript
export const idrAmountSchema = z.coerce
  .number()
  .int('Nominal harus berupa bilangan bulat')
  .positive('Nominal harus lebih dari 0')
  .max(999_999_999_999, 'Nominal melebihi batas wajar');
```
Executing:
```js
contracts.idrAmountSchema.safeParse(true)  // returns { success: true, data: 1 }
contracts.idrAmountSchema.safeParse([100]) // returns { success: true, data: 100 }
```
Because `z.coerce.number()` utilizes `Number(val)`, boolean `true` coerces to 1 IDR and arrays coerce to numbers. Furthermore, `optionalIdrAmountSchema` coerces `null` to `0`, preventing nullable master data fields from being cleared.

---

## 2. Logic Chain

1. **Topological Builds & Dependency Graph:**
   - Observations 1.1.1 and 1.1.2 show that the monorepo graph is strictly acyclic, package boundaries are respected, and `pnpm turbo run build --force` executes deterministically. This satisfies Task 1.
2. **Neo-brutalism Aesthetics:**
   - Observation 1.2.1 proves that all shadows have zero blur (`0` blur parameter), borders are 2px ink, buttons utilize tactile active translate physics (`translate-x-[2px] translate-y-[2px]`), and no AI slop components (such as gradients or generic pill buttons) exist in the source code.
3. **Accessibility Compliance (WCAG AA):**
   - Observation 1.2.2 shows that `Badge` with `variant="aman"` uses `text-xs` (12px), which falls under WCAG's "normal text" definition (threshold >= 4.5:1).
   - The computed contrast ratio of `#287D4F` text on `bg-success/15` (`#DFECE5`) is **4.17:1**, which mathematically violates WCAG 2.1 Criterion 1.4.3 (Contrast Minimum).
   - Similarly, `variant="menipis"` on page background `--bg` yields **4.48:1** (< 4.5:1).
   - This directly contradicts the design specification (`doc/design.md` §2: "Pastikan kombinasi teks/latar memenuhi kontras WCAG AA") and Worker 1's claim of WCAG AA compliance.
4. **DTO Edge Case Resilience:**
   - Observation 1.3.1 demonstrates that user emails with leading or trailing whitespace (common in mobile auto-fill) are rejected by auth endpoints due to incorrect Zod chaining order.
   - Observation 1.3.2 proves that standard Indonesian currency notation with cents (`Rp 1.500.000,00`) results in a critical 100x financial calculation error in `parseIDR`.
   - Observation 1.3.3 shows that raw `z.coerce.number()` creates unexpected coercion behaviors.
5. **Verdict Derivation:**
   - Because the WCAG AA accessibility gate is violated in core UI components, and the shared contracts contain an active user-facing validation bug (email whitespace) and a 100x financial parsing flaw, Milestone 1 cannot be approved in its current state. The explicit verdict is `REJECT`.

---

## 3. Caveats

1. **Docker Environment:** Docker Compose configuration was reviewed and confirmed valid, but container spinning (`pnpm docker:up`) depends on the host system Docker daemon.
2. **Next Milestones:**
   - Database tables, foreign keys, and migrations are scoped to Milestone 2.
   - Live REST endpoints and auth handlers are scoped to Milestone 3.

---

## 4. Conclusion

**Verdict: REJECT**

Milestone 1 has successfully established a high-performing monorepo structure, Turborepo pipelines, package skeletons, and Neo-brutalism visual foundations. However, Milestone 1 cannot be approved until the following three actionable defect categories are resolved:

### Required Action Items for Worker:
1. **Fix Badge WCAG AA Contrast:**
   - Update `packages/ui/src/components/badge.tsx` so that `aman` and `menipis` satisfy the 4.5:1 contrast ratio for normal text. For example, darken the text color to `#1B5E3A` for `aman` (yielding > 5.5:1 contrast) or use `--ink` (`#171717`) text on the badge with semantic icon & border coloring.
2. **Fix Zod Email Sanitization Chaining:**
   - In `packages/contracts/src/auth/auth.schema.ts`, replace `.email().toLowerCase().trim()` with:
     ```typescript
     email: z.string().trim().toLowerCase().pipe(z.string().email('Format email tidak valid'))
     ```
     in `loginSchema`, `registerSchema`, `inviteMemberSchema`, and `forgotPasswordSchema`.
3. **Fix `parseIDR` Decimal Handling:**
   - In `packages/contracts/src/common/idr.ts`, strip decimal cents (`,00` or `,\d{2}`) before stripping non-digits:
     ```typescript
     export function parseIDR(formatted: string): number {
       const cleaned = formatted.replace(/,\d{2}$/, '').replace(/[^0-9-]/g, '');
       const parsed = parseInt(cleaned, 10);
       return isNaN(parsed) ? 0 : parsed;
     }
     ```
4. **Fix Monorepo Lint Hang:**
   - Add `.eslintrc.cjs` to `apps/web` extending `next/core-web-vitals` or define shared ESLint dependencies in `packages/eslint-config` so `pnpm lint` completes non-interactively in CI.

---

## 5. Verification Method

To independently verify these findings, run the following commands:

```bash
# 1. Verify dependency graph and topological compilation
pnpm turbo run build --force

# 2. Verify WCAG AA Contrast Failure on Badge Aman
python3 /Users/mac/.gemini/config/skills/antislop-human/contrast-check.py 287D4F DFECE5
# Output will display:
# ratio: 4.17:1
# normal text (4.5:1): FAIL

# 3. Verify Email Whitespace Rejection Bug
node -e '
const { loginSchema } = require("./packages/contracts/dist/index.js");
const res = loginSchema.safeParse({ email: "  user@example.com  ", password: "Password123!" });
console.log("Success with spaces:", res.success);
if (!res.success) console.log("Issue:", res.error.issues[0].message);
'
# Output displays: Success with spaces: false, Issue: Format email tidak valid

# 4. Verify 100x IDR Parse Inflation
node -e '
const { parseIDR } = require("./packages/contracts/dist/index.js");
console.log("Result:", parseIDR("Rp 1.500.000,00"));
'
# Output displays: Result: 150000000 (100x inflation)
```

### Invalidation Conditions
- A WCAG 2.1 compliant color pairing for `Badge` `aman` (contrast ratio >= 4.5:1).
- `loginSchema.safeParse({ email: "  user@example.com  ", password: "Password123!" })` returning `success: true` with trimmed lowercase email.
- `parseIDR("Rp 1.500.000,00")` returning `1500000`.
