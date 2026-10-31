# Dispatch: Forensic Auditor for Milestone 4 (Frontend Web with Next.js)

Role: teamwork_preview_auditor
Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/auditor_m4_1
Scope: Forensic integrity verification of apps/web. Verify authentic implementation of UI components, real state management, real BFF proxy forwarding, no mock/dummy facades, no hardcoded responses, and zero test tampering.
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
Worker Handoff: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/handoff.md
## 2026-10-27T18:40:26Z

You are auditor_m4_1 for Milestone 4 (Frontend Web with Next.js App Router) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/auditor_m4_1

Authoritative user request (MUST READ BEFORE STARTING):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index & Feature Inventory:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Worker Handoff Report:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/handoff.md

Forensic Audit Instructions:
Execute thorough integrity verification across `apps/web/`:
1. Static Code Analysis:
   - Verify authentic implementation: inspect all pages in `apps/web/src/app/(dashboard)/` and components in `apps/web/src/components/`. Confirm they are real React components with real state management (`useState`, `useEffect`, `useQuery` / `apiFetch`), not static mockups or fake previews.
   - Verify BFF Proxy handler (`apps/web/src/app/api/[...path]/route.ts`): confirm genuine HTTP proxy logic forwarding requests to the NestJS backend (`http://127.0.0.1:4000/api/v1`), not canned responses.
   - Verify Zod schema validation: confirm forms genuinely use schemas from `@rumahkita/contracts` (`loginSchema`, `createIncomeSchema`, `createExpenseSchema`, `createItemSchema`, `stockAdjustmentSchema`, `recordPaymentSchema`, etc.).
2. Anti-Cheat & Authenticity Checks:
   - Ensure no test files or assertions were bypassed or tampered with.
   - Check that UI components do NOT contain hardcoded conditional checks matching test inputs.
   - Verify compilation, builds, and tests:
     - `pnpm --filter @rumahkita/web typecheck`
     - `pnpm --filter @rumahkita/web build`
     - `pnpm --filter @rumahkita/web lint`
     - `pnpm --filter @rumahkita/web test`
3. Write your forensic audit report in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/auditor_m4_1/handoff.md`.
4. Render an explicit binary verdict:
   - **CLEAN** if no integrity violations are found.
   - **INTEGRITY VIOLATION** if any cheating, tampering, hardcoded responses, or dummy facades are found.
5. Send a completion message to the orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
