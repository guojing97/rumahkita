## 2026-10-27T19:17:40Z
You are Worker M5 Worker 1.
Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m5_worker_1

You MUST read the authoritative user request first:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Also read:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_arch_1/analysis.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_m5_spec_2/analysis.md
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m5_e2e_3/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive File Ownership:
`apps/worker/**`

Objective:
Implement the complete Notification Worker Daemon in `apps/worker` per the architecture and specifications discovered by the exploratory squad, and verify 100% pass on the full E2E test suite:

1. Dependencies:
   Add `"drizzle-orm": "^0.35.3"` to `apps/worker/package.json` if not present. Run `pnpm install` so dependencies resolve cleanly.

2. Architecture & Implementation in `apps/worker/src`:
   - `daemon.ts`: Main `NotificationWorker` class managing polling interval (from `WORKER_POLL_INTERVAL_MS` or default 5000), batch execution, in-flight processing tracking, and graceful shutdown (intercepting SIGTERM/SIGINT, draining in-flight jobs within 10s, and closing DB connections cleanly).
   - `polling/outbox-poller.ts`: Two-phase transaction pattern using Drizzle ORM `.for('update', { skipLocked: true })` on `schema.notificationEvents`. Queries `status = 'PENDING'` AND (`nextRetryAt IS NULL OR nextRetryAt <= NOW()`), ordered by `createdAt ASC`, limit batch size (e.g. 10). Within that short transaction, claims rows to `status = 'PROCESSING'`, `attempts = attempts + 1`, and sets lease `nextRetryAt = NOW() + 5 minutes`.
   - `processors/event-processor.ts`: Processes claimed events outside the DB transaction. Dispatches to Email or WhatsApp adapter. On success, updates `status = 'SENT'`, `sentAt = NOW()`. On failure, computes next retry using backoff math, updates `lastError = err.message`, and if attempts < maxAttempts sets `status = 'PENDING'` with `nextRetryAt`, else if attempts >= maxAttempts sets `status = 'FAILED'` (dead-letter) with `nextRetryAt = null`.
   - `processors/retry.ts`: Backoff calculation implementing exponential delay ($30 \times 2^{attempts - 1}$ seconds or $60 \times 2^{attempts - 1}$ seconds) capped at `maxAttempts` (5).
   - `adapters/email.adapter.ts`: Validates email, formats Indonesian email notification message with item name, current stock, threshold, and unit, and logs structured output.
   - `adapters/whatsapp.adapter.ts`: Normalizes phone number to E.164 `+62...`, validates against `/^\+62[0-9]{8,15}$/`, formats WhatsApp message in Indonesian, and logs structured output. Supports test error hooks if recipient indicates failure simulation.
   - `index.ts`: Clean entry point that can be executed directly as a daemon or imported programmatically.

3. Automated Unit Tests:
   Add unit tests in `apps/worker/src/__tests__/` covering:
   - Polling query logic and concurrency claim transitions
   - Retry exponential backoff calculation and maxAttempts dead-lettering
   - Email & WhatsApp adapter validation and formatting
   - Graceful shutdown signal handling

4. Verification & Testing:
   - Run typecheck: `pnpm --filter @rumahkita/worker typecheck`
   - Run build: `pnpm --filter @rumahkita/worker build`
   - Run unit tests: `pnpm --filter @rumahkita/worker test`
   - Verify backend API is up (running on port 4000) and execute the full E2E test suite:
     `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`
     Verify that all 56 E2E tests pass with 0 failures!

Output Requirements:
Write your implementation details and test execution outputs to:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m5_worker_1/handoff.md

Completion Criteria:
1. `apps/worker` fully implemented, builds cleanly with 0 TypeScript errors.
2. Unit tests pass cleanly.
3. Full E2E test suite passes 100% (56/56 passing).
4. Full command logs and evidence documented in `handoff.md`.
When done, notify me via send_message.
