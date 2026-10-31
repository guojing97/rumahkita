## 2026-10-27T18:40:18Z
You are challenger_m4_2 for Milestone 4 (Frontend Web with Next.js App Router) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/challenger_m4_2

Authoritative user request (MUST READ BEFORE STARTING):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index & Feature Inventory:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Design Spec & PRD:
- /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
- /Users/mac/Projects/03-Labs/RumahKita/doc/prd.md

Worker Handoff Report:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/handoff.md

Adversarial Integration & Form Validation Instructions:
1. Empirically verify BFF Proxy and API client robustness:
   - Verify `/api/[...path]` proxy forwards query strings, request bodies, and headers (`X-Household-Id`, `Authorization`, `Idempotency-Key`).
   - Verify error envelope handling: `ApiClientError` correctly parses backend error responses (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 422 Unprocessable Entity) and exposes field error details.
   - Verify silent token refresh flow: when access token expires (401), client automatically triggers refresh before replaying request.
2. Empirically verify client form validation & atomic modals:
   - Negative nominal rejection on client forms before sending.
   - Stock adjustment client validation: prevents adjustments resulting in negative stock, requires non-empty reason.
   - Debt repayment client validation: prevents recording payment exceeding remaining balance.
   - Purchase completion modal: requires confirmation, previews stock increment, sends unique UUID idempotency key.
   - RFC 4180 CSV export: triggers file download with proper stream and filename.
3. Run tests / typechecks / builds:
   - `pnpm --filter @rumahkita/web typecheck`
   - `pnpm --filter @rumahkita/web build`
   - `pnpm --filter @rumahkita/web test`
4. Write your adversarial challenge report in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/challenger_m4_2/handoff.md` with an explicit verdict: **APPROVE** or **REQUEST_CHANGES**.
5. Send a completion message to the orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
