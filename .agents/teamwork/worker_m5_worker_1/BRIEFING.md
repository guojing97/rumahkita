# BRIEFING — 2026-10-28T02:26:00Z

## Mission
Implement the complete Notification Worker Daemon in `apps/worker` per the architecture and specifications, and verify 100% pass on the full E2E test suite.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m5_worker_1
- Original parent: 70f30c57-3b98-4e37-8e6c-d4b8d72ee082
- Milestone: M5

## 🔒 Key Constraints
- Exclusive File Ownership: `apps/worker/**`
- DO NOT CHEAT: Genuine implementation, real state, no dummy/facade implementations.
- Drizzle ORM `.for('update', { skipLocked: true })` for outbox polling.
- Clean compilation, zero TypeScript errors, unit tests passing.
- 56/56 E2E tests passing.

## Current Parent
- Conversation ID: 70f30c57-3b98-4e37-8e6c-d4b8d72ee082
- Updated: not yet

## Task Summary
- **What to build**: Complete Notification Worker Daemon in `apps/worker` with outbox poller, event processor, exponential retry backoff, email and whatsapp adapters, graceful shutdown, and unit tests.
- **Success criteria**: `apps/worker` typecheck, build, unit tests, and 56/56 E2E tests pass.
- **Interface contracts**: `PROJECT.md`, `packages/contracts/src/notifications/notification.schema.ts`, `packages/db/src/schema/notification.ts`.
- **Code layout**: `apps/worker/**`

## Key Decisions Made
- Added `drizzle-orm: ^0.35.3` to `apps/worker/package.json` for direct query builder support with PostgreSQL row locking (`.for('update', { skipLocked: true })`).
- Adopted two-phase outbox processing: short DB transaction to atomically claim batch and advance status to `PROCESSING` with lease `nextRetryAt = NOW() + 5 minutes`, then dispatching outside transactions.
- Implemented exponential backoff $30 \times 2^{attempts - 1}$ capped at `maxAttempts` (5), dead-lettering permanent failures to status `FAILED` with `nextRetryAt = null`.
- Provided Indonesian notification templates and validation for Email (RFC 5322) and WhatsApp (E.164 normalization `+62...`).

## Artifact Index
- handoff.md — final comprehensive report
- progress.md — liveness heartbeat

## Change Tracker
- **Files modified**:
  - `apps/worker/package.json`: added `drizzle-orm` and `test` script
  - `apps/worker/src/index.ts`: entry point supporting direct and module execution
  - `apps/worker/src/daemon.ts`: NotificationWorker daemon managing polling and graceful shutdown
  - `apps/worker/src/polling/outbox-poller.ts`: FOR UPDATE SKIP LOCKED batch claiming
  - `apps/worker/src/processors/event-processor.ts`: non-transactional event dispatcher and status updater
  - `apps/worker/src/processors/retry.ts`: exponential backoff calculation
  - `apps/worker/src/adapters/types.ts`: NotificationAdapter contract
  - `apps/worker/src/adapters/email.adapter.ts`: Email validation and formatting
  - `apps/worker/src/adapters/whatsapp.adapter.ts`: WhatsApp E.164 normalization and formatting
  - `apps/worker/src/adapters/index.ts`: Adapter factory
  - `apps/worker/src/__tests__/retry.test.ts`: backoff unit tests
  - `apps/worker/src/__tests__/adapters.test.ts`: adapter unit tests
  - `apps/worker/src/__tests__/event-processor.test.ts`: processor unit tests
  - `apps/worker/src/__tests__/poller-and-concurrency.test.ts`: poller unit tests
  - `apps/worker/src/__tests__/daemon-lifecycle.test.ts`: lifecycle and drain unit tests
- **Build status**: Pass (typecheck 0 errors, build 0 errors, lint 0 errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (30/30 unit tests pass, 56/56 E2E tests pass)
- **Lint status**: 0 violations
- **Tests added/modified**: 30 unit tests added across 5 test suites

## Loaded Skills
- Source: /Users/mac/.gemini/config/skills/backend-developer/SKILL.md
  - Core methodology: Robust backend engineering, transactions, concurrency safety, and testing.
