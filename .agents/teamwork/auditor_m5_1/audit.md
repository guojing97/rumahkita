# Forensic Audit Report: Milestone 5 Phase 1 (`apps/worker`) & Project Integrity

**Work Product**: `apps/worker` Notification Worker Daemon & Project E2E Suite  
**Profile**: General Project  
**Integrity Mode**: Development Mode (as specified in `ORIGINAL_REQUEST.md`, line 8)  
**Date**: 2026-10-28  
**Auditor**: Forensic Auditor M5 1 (`auditor_m5_1`)  
**Verdict**: **CLEAN**

---

## 1. Executive Summary

A comprehensive, adversarial, and mode-agnostic forensic integrity audit was conducted on Milestone 5 Phase 1 (`apps/worker`), its interaction with `@rumahkita/db`, the NestJS API, and the monorepo E2E test suite.

Empirical verification established:
1. **Zero Cheating or Facade Patterns**: No hardcoded test responses, no short-circuited conditionals, and no fake mocks bypassing database transactions in production code.
2. **PostgreSQL Pessimistic Concurrency (`FOR UPDATE SKIP LOCKED`)**: Verified empirically against a live PostgreSQL 16 Alpine container with concurrent transactions. Worker 2 successfully skipped rows locked by Worker 1 without blocking or table contention.
3. **Genuine Outbox State Transitions**: Verified via direct SQL queries against `notification_events`. Rows genuinely mutated through `PENDING` -> `PROCESSING` -> `SENT` (for successful dispatch) and `PENDING` -> `PROCESSING` -> `FAILED` (dead-letter queue after reaching 5 attempts).
4. **Independent Command Execution**:
   - `pnpm --filter @rumahkita/worker typecheck`: Exit code 0 (0 errors)
   - `pnpm --filter @rumahkita/worker build`: Exit code 0 (Compiled cleanly to `dist/`)
   - `pnpm --filter @rumahkita/worker test`: Original 30 unit tests across 5 suites passed 100% (30/30)
   - `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`: All 56 opaque-box E2E tests across 19 suites passed 100% (56/56)
   - Real-time event consumption: 12 out of 12 generated outbox events in PostgreSQL were claimed and delivered (`status = 'SENT'`) by the live daemon.

---

## 2. Forensic Phase Results

| Phase | Forensic Check | Result | Evidence / Details |
|---|---|---|---|
| **Phase 1: Source Code Analysis** | Hardcoded Output Detection | **PASS** | Ripgrep scans across `apps/worker/src/` and `tests/` revealed zero hardcoded test outputs or return-constant bypasses. |
| | Facade & Dummy Implementation Detection | **PASS** | `OutboxPoller`, `EventProcessor`, `EmailAdapter`, `WhatsAppAdapter`, and `NotificationWorker` contain authentic business logic, validation regexes, and retry math. |
| | Pre-Populated Artifact Detection | **PASS** | No pre-existing test results, synthetic logs, or mock attestations exist. |
| **Phase 2: Behavioral Verification** | PostgreSQL `FOR UPDATE SKIP LOCKED` Real Concurrency | **PASS** | Empirically verified with 2 concurrent PostgreSQL clients. Worker 1 locked row `bf4b9bf2-...`; Worker 2 claimed row `b55343b4-...` and skipped the locked row without error. |
| | Genuine Outbox State Mutations | **PASS** | Verified via direct SQL queries for both success (`SENT` with `sentAt` timestamp) and terminal dead-letter (`FAILED` with `lastError` and `nextRetryAt = null`). |
| | Independent Typecheck & Build | **PASS** | `tsc --noEmit` and `tsc` completed with exit code 0. |
| | Worker Unit Test Suite | **PASS** | 30/30 tests passed across `retry.test.ts`, `adapters.test.ts`, `event-processor.test.ts`, `poller-and-concurrency.test.ts`, and `daemon-lifecycle.test.ts`. |
| | Monorepo E2E Test Suite | **PASS** | 56/56 tests passed across Tiers 1–4 against live NestJS API on port 4000. |
| | Live Daemon Processing | **PASS** | Daemon claimed and updated all 12 events generated during E2E run in PostgreSQL to `SENT`. |

---

## 3. Empirical Evidence & Raw Tool Outputs

### 3.1 Drizzle ORM SQL Compilation Check
Command:
```bash
pnpm --filter @rumahkita/worker exec node -e '
const { schema, createDatabaseClient } = require("@rumahkita/db");
const { eq } = require("drizzle-orm");
const { db, queryClient } = createDatabaseClient();
const query = db.select().from(schema.notificationEvents).where(eq(schema.notificationEvents.status, "PENDING")).limit(5).for("update", { skipLocked: true });
console.log("SQL:", query.toSQL());
queryClient.end();
'
```
Raw Output:
```json
SQL: {
  sql: 'select "id", "household_id", "item_id", "event_type", "channel", "recipient", "payload", "status", "attempts", "max_attempts", "last_error", "next_retry_at", "sent_at", "created_at" from "notification_events" where "notification_events"."status" = $1 limit $2 for update skip locked',
  params: [ 'PENDING', 5 ]
}
```

### 3.2 Live PostgreSQL Row Locking Verification (`FOR UPDATE SKIP LOCKED`)
Verification script executed concurrent transactions against PostgreSQL 16 Alpine:
- Worker 1 opened a transaction, selected 1 pending event `FOR UPDATE SKIP LOCKED`, and held the lock.
- Worker 2 concurrently called `poller.claimBatch()`.
Raw Output:
```text
Inserted test events: bf4b9bf2-d4a4-419d-9708-71c4a6547d7e b55343b4-9278-42ee-b64f-0057585ba2ce
Worker 1 acquired row: [ 'bf4b9bf2-d4a4-419d-9708-71c4a6547d7e' ]
Worker 2 claimed rows: [ 'b55343b4-9278-42ee-b64f-0057585ba2ce' ]
Did Worker 2 skip Worker 1 locked row? true
Worker 1 completing tx
SUCCESS: Real PostgreSQL row locking with FOR UPDATE SKIP LOCKED verified!
```

### 3.3 Live PostgreSQL Outbox State Transition Verification
Verified database state transitions in PostgreSQL across all lifecycle phases:
Raw Output:
```text
Initial state in DB: {
  id: '64c06175-a509-4bd0-b9f9-704140b55720',
  status: 'PENDING',
  attempts: 0
}
Post-claim state in DB: {
  id: '64c06175-a509-4bd0-b9f9-704140b55720',
  status: 'PROCESSING',
  attempts: 1,
  nextRetryAt: 2026-10-27T19:35:32.903Z
}
Post-dispatch state in DB: {
  id: '64c06175-a509-4bd0-b9f9-704140b55720',
  status: 'SENT',
  sentAt: 2026-10-27T19:30:32.917Z,
  lastError: null
}
Fail event post-claim in DB: {
  id: '632331c6-9107-425f-9ca9-dfffbd66ff55',
  status: 'PROCESSING',
  attempts: 5
}
Fail event final dead-letter state in DB: {
  id: '632331c6-9107-425f-9ca9-dfffbd66ff55',
  status: 'FAILED',
  lastError: 'Simulated email delivery failure for recipient: fail@example.com'
}
SUCCESS: Genuine PostgreSQL outbox row mutations verified for all state transitions!
```

### 3.4 Command Execution: Typecheck
Command: `pnpm --filter @rumahkita/worker typecheck`
Exit code: 0
```text
$ tsc --noEmit
```

### 3.5 Command Execution: Build
Command: `pnpm --filter @rumahkita/worker build`
Exit code: 0
```text
$ tsc
```

### 3.6 Command Execution: Worker Unit Tests
Command: `pnpm --filter @rumahkita/worker test` (Original suites: `retry.test.ts`, `adapters.test.ts`, `event-processor.test.ts`, `poller-and-concurrency.test.ts`, `daemon-lifecycle.test.ts`)
Exit code: 0
```text
ℹ tests 30
ℹ suites 7
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2462.003062
```

### 3.7 Command Execution: Full Monorepo Opaque-Box E2E Test Suite
Command: `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`
Exit code: 0
```text
============================================================
 RumahKita Opaque-Box E2E Test Suite
 Target API:  http://localhost:4000/api/v1
============================================================

[Healthcheck] Verifying connectivity to http://localhost:4000/api/v1/household...
[Healthcheck] API is reachable (HTTP 401). Proceeding with tests.

Discovered 19 test suite file(s). Running...

▶ Tier 1: Authentication & Sessions (6 tests pass)
▶ Tier 1: Dashboard & Reports Feature Coverage (4 tests pass)
▶ Tier 1: Debts & Receivables Feature Coverage (2 tests pass)
▶ Tier 1: Expenses Feature Coverage (3 tests pass)
▶ Tier 1: Incomes Feature Coverage (4 tests pass)
▶ Tier 1: Inventory & Stock Adjustments (3 tests pass)
▶ Tier 1: Master Data & Household (4 tests pass)
▶ Tier 1: Purchases Feature Coverage (2 tests pass)
▶ Tier 2: Date Boundaries & Query Parameters (2 tests pass)
▶ Tier 2: Debts & Receivables Boundary Cases (4 tests pass)
▶ Tier 2: Financial Boundary & Corner Cases (5 tests pass)
▶ Tier 2: Inventory Boundary & Corner Cases (4 tests pass)
▶ Tier 2: Security & Authorization Boundaries (4 tests pass)
▶ Tier 3: Multi-Tenant Data Isolation Guard (1 test pass)
▶ Tier 3: Debt Payment Lifecycle (1 test pass)
▶ Tier 3: Purchase -> Stock -> Expense Atomicity (3 tests pass)
▶ Tier 3: Stock Threshold & Outbox Event Generation (2 tests pass)
▶ Tier 4: Monthly Household Operational Cycle (1 test pass)
▶ Tier 4: Multi-Member Household Collaboration (1 test pass)
ℹ tests 56
ℹ suites 19
ℹ pass 56
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 26093.821916

============================================================
 [PASS] All test suites completed successfully.
```

### 3.8 PostgreSQL Post-E2E Outbox Events Audit
Direct SQL query on `notification_events` after E2E suite completion:
```sql
SELECT status, count(*) FROM notification_events GROUP BY status;
```
Result:
```text
Result(1) [ { status: 'SENT', count: '12' } ]
```
Sample event records in PostgreSQL:
```text
{ id: '79b5a73c-...', event_type: 'STOCK_LOW', channel: 'WHATSAPP', recipient: '+6281234567890', status: 'SENT', attempts: 1, sent_at: '2026-10-27T19:32:29.642Z' }
{ id: '6aa73e17-...', event_type: 'STOCK_LOW', channel: 'EMAIL', recipient: 'budi@rumahkita.local', status: 'SENT', attempts: 1, sent_at: '2026-10-27T19:32:29.642Z' }
{ id: '751b9a76-...', event_type: 'STOCK_OUT', channel: 'EMAIL', recipient: 'ani@rumahkita.local', status: 'SENT', attempts: 1, sent_at: '2026-10-27T19:32:29.642Z' }
```

---

## 4. Adversarial Findings (For Phase 2 Hardening)

During Phase 2 adversarial stress-testing by `challenger_m5_2`, 3 hostile edge cases were discovered in `apps/worker`:
1. **WhatsApp Phone Normalization with SQL Comment Prefix**:
   - In `WhatsAppAdapter.normalizePhoneNumber()`, `cleaned = phone.trim().replace(/[\s\-()]/g, '')` strips hyphens and spaces. When passed `'-- 081234567890'`, it stripped `-- ` and left `081234567890`, which normalized to `+6281234567890`.
   - *Recommendation*: Validate against `/^[+0-9\s\-()]+$/` before stripping characters so non-phone characters are rejected early.
2. **Email RFC Leading Dot**:
   - RFC 5322 regex allowed `.user@domain.com` (leading dot in local-part).
   - *Recommendation*: Use `^(?!\.)[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+(?<!\.)@...` to forbid leading/trailing dots in local-part.
3. **Unhandled Promise Rejection Risk in `NotificationWorker.pollOnce()`**:
   - `this.activeBatchPromise = batchPromise;` was assigned without a `.catch()` attached immediately, which can surface an unhandled promise rejection if a caller does not await it in the same microtask turn.
   - *Recommendation*: Add `.catch(() => {})` to `this.activeBatchPromise` when storing in-flight promise reference.

These findings are genuine quality/hardening opportunities for Phase 2, and do not constitute an integrity violation.

---

## 5. Final Verdict

**CLEAN**  
Milestone 5 Phase 1 (`apps/worker`) satisfies all integrity rules under Development Mode with 100% genuine implementation, authentic database transactions, and zero cheating.
