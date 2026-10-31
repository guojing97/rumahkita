## 2026-10-27T13:22:22Z
You are Worker 2 (Milestone 1 Remediation) for the RumahKita project.

Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m1_remediation_2
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Master Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
Gate Review Feedback: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/orchestrator_1/GATE_STATUS.md
Reviewer 2 Report: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/reviewer_m1_2/handoff.md
Challenger 2 Report: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/challenger_m1_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Specific Remediation Actions:
1. ESLint & Monorepo CI non-interactive execution:
   - In `apps/web`: create `.eslintrc.cjs` with `module.exports = { extends: ['next/core-web-vitals'] };`.
   - In `packages/eslint-config/package.json`: declare proper dependencies (`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-prettier`, `eslint`).
   - In `apps/api/package.json` and `apps/worker/package.json`: ensure `"lint"` script is defined and works.
   - In `apps/web/package.json`: ensure `"lint": "next lint"` runs non-interactively without prompting.
   - Verify `pnpm lint` runs across the entire workspace non-interactively and passes.
2. `packages/contracts/src/common/idr.ts`:
   - Fix `optionalIdrAmountSchema`: Use `z.preprocess((val) => (val === null || val === '' || val === undefined ? undefined : val), ...)` so `null` converts to `undefined` instead of coercing to `0`.
   - Fix `parseIDR`: Strip `,00` / decimal cents before non-digit stripping so `parseIDR("Rp 150.000,00")` parses to `150000`, NOT `15000000`.
   - Fix `idrAmountSchema`: Disallow booleans by preprocessing `typeof val === 'boolean' ? NaN : val` so `true` is rejected.
3. `packages/contracts/src/inventory/stock-movement.schema.ts`:
   - In `stockAdjustmentSchema`: ensure `reason: z.string().trim().min(3, 'Alasan penyesuaian stok wajib diisi minimal 3 karakter').max(500)` so whitespace-only strings are rejected.
4. `packages/contracts/src/auth/auth.schema.ts`:
   - Fix email validation chaining: use `z.preprocess((val) => (typeof val === 'string' ? val.trim().toLowerCase() : val), z.string().email('Format email tidak valid'))` across `loginSchema`, `registerSchema`, `inviteMemberSchema`, `forgotPasswordSchema`.
5. `packages/ui/src/components/badge.tsx`:
   - Fix WCAG AA contrast for `Badge` `variant="aman"`: change text color from `#287D4F` to darker high-contrast green `#1B5E38` so text contrast on `bg-success/15` meets or exceeds 4.5:1 WCAG AA.
6. `turbo.json`:
   - In the `test` task, remove `"outputs": ["coverage/**"]` or specify `"outputs": []` so Turborepo does not emit empty output directory warnings.
7. Verification & Automated Tests:
   - Add new test cases to `packages/contracts/src/__tests__/contracts.test.ts` covering all the fixed edge cases (email with whitespace, optional IDR with null, parseIDR with decimal cents, boolean in IDR, stock adjustment with whitespace reason).
   - Run `pnpm lint` (must pass non-interactively with exit code 0).
   - Run `pnpm build` (must pass with exit code 0).
   - Run `pnpm typecheck` (must pass with exit code 0).
   - Run `pnpm test` (all tests must pass with exit code 0).

Deliverables:
- Write handoff report with verbatim terminal output to:
  `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m1_remediation_2/handoff.md`
- Send completion message to parent orchestrator.
