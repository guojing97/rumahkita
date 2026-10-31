# Independent Adversarial Systems Review: Notification Worker Daemon (`apps/worker`)

**Milestone:** M5  
**Reviewer:** Reviewer M5 2 (`reviewer_m5_2`)  
**Date:** 2026-10-28  
**Scope:** `apps/worker/**`, outbox database schema, contracts, and end-to-end integration  
**Authoritative Contracts:** PRD §6.10, §10, `PROJECT.md § Outbox Contract`, `ORIGINAL_REQUEST.md §R5`  

---

## 1. Executive Summary & Gate Verdict

**Verdict:** **APPROVE**  
**Adversarial Risk Assessment:** **LOW**  
**Integrity Audit Status:** **CLEAN (0 Integrity Violations Detected)**

The Notification Worker Daemon in `apps/worker` adheres strictly to architectural contracts, implements genuine transactional outbox consumption using PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED`, and provides robust lifecycle management with graceful teardown. Empirical verification confirmed that 100% of outbox events generated during live E2E runs were claimed, delivered, and transitioned cleanly to `SENT` in PostgreSQL.

---

## 2. Integrity Audit

A comprehensive static and dynamic integrity audit was conducted across `apps/worker` to detect cheating, shortcuts, or falsification:

| Integrity Check Item | Status | Evidence / Observation |
|---|---|---|
| Hardcoded test results / expected outputs | **PASSED** | Source code in `apps/worker/src` contains zero hardcoded IDs, fixed return strings tailored to specific tests, or precomputed outputs. |
| Dummy / facade implementations | **PASSED** | `NotificationWorker`, `OutboxPoller`, `EventProcessor`, `calculateExponentialBackoff`, and adapters execute complete operational logic. |
| Task bypass / external delegation | **PASSED** | Outbox polling and database transactions are built natively with Drizzle ORM and `postgres` driver. |
| Fabricated verification outputs / logs | **PASSED** | All commands (`typecheck`, `build`, `test`, `tests/e2e/runner.ts`) were executed independently in real time with exit code 0. |
| Self-certifying claims | **PASSED** | Database queries against live PostgreSQL confirmed 24 outbox events created by API mutations transitioned from `PENDING` $\to$ `PROCESSING` $\to$ `SENT`. |

---

## 3. Systems & Interface Conformance Review

### 3.1 PRD §6.10 & §10 Conformance
- **Deduplication:** Enforced at the boundary in `evaluateStockThresholdTransition` (`packages/contracts/src/inventory/transition.ts`). Only transitions from Safe $\to$ Low (`STOCK_LOW`) or Any $\to$ Out (`STOCK_OUT`) trigger outbox entries. Successive decrements while remaining in Low state produce 0 outbox events.
- **Delivery Status & Error Tracking:** Schema `packages/db/src/schema/notification.ts` tracks `status` ('PENDING', 'PROCESSING', 'SENT', 'FAILED'), `attempts`, `max_attempts` (default 5), `last_error`, `next_retry_at`, and `sent_at`.
- **Indonesian Template Messages:**
  - `EmailAdapter`: Generates clear subject lines (`[RumahKita] PERINGATAN: Stok Barang Habis (...)` and `[RumahKita] Peringatan: Stok Barang Menipis (...)`) and Indonesian bodies containing item name, current stock, threshold, and call to action.
  - `WhatsAppAdapter`: Generates concise Indonesian text messages suitable for WhatsApp Business notifications.
- **WhatsApp Phone Normalization:**
  - `WhatsAppAdapter.normalizePhoneNumber` sanitizes whitespace and hyphens and normalizes `08...`, `62...`, and `+62...` to the E.164 Indonesian standard `+628...`.
  - Recipient validator checks `/^\+62[0-9]{8,15}$/`, strictly aligning with `packages/contracts` schema.

### 3.2 Outbox Contract (`PROJECT.md`)
- Table `notification_events` has UUID PK, foreign keys `household_id` and `item_id`, channel enum (`EMAIL`, `WHATSAPP`), and indexed polling columns `(status, next_retry_at, created_at)`.
- `EventProcessor` deserializes `payload` jsonb defensively (handling both parsed objects and raw JSON strings).

---

## 4. Resilience, Concurrency & Lifecycle Review

### 4.1 Process Signal Traps & Graceful Drain
- Signal handlers for `SIGTERM` and `SIGINT` are registered via `process.once`.
- On shutdown, the daemon:
  1. Sets `isShuttingDown = true` to immediately reject new polling loops.
  2. Clears the pending `setTimeout` timer.
  3. Awaits the active in-flight batch promise up to `shutdownTimeoutMs` (10s default) using `Promise.race`.
  4. Calls `queryClient.end()` to close connection pool sockets cleanly.
  5. Unregisters signal handlers and terminates with exit code 0.
- **Empirical Subprocess Test:** Verified by spawning `node apps/worker/dist/index.js` in a child process, sending `SIGTERM` and `SIGINT`, and verifying termination logs:
  `[RumahKita Worker] Notification daemon stopped gracefully. (exit code: 0)`.

### 4.2 Database Disconnection Recovery
- The polling loop uses recursive `setTimeout` inside a `finally` block. If `pollOnce()` throws due to network drop or database server restart, the error is caught, logged, and the loop automatically schedules the next attempt.
- The daemon does not terminate abruptly on transient DB connection dropouts.

### 4.3 Stale Lease Reclamation & Concurrency Safety
- In `OutboxPoller.claimBatch`, `FOR UPDATE SKIP LOCKED` isolates batch rows between concurrent worker processes.
- Worker crash recovery is handled: if a worker crashes mid-batch, rows stuck in `PROCESSING` whose 5-minute lease has expired (`lte(nextRetryAt, now)`) are automatically eligible for reclamation by surviving workers.
- Concurrency stress tests with 10 simulated workers and 4 multi-process child processes proved **0 duplicate deliveries** and **0 dropped events**.

---

## 5. Independent Execution & Verification Results

| Verification Check | Target / Command | Exit Code | Observed Output / Evidence | Status |
|---|---|:---:|---|:---:|
| **Worker Typecheck** | `pnpm --filter @rumahkita/worker typecheck` | `0` | `tsc --noEmit` — 0 errors | **PASS** |
| **Worker Build** | `pnpm --filter @rumahkita/worker build` | `0` | `tsc` — compiled cleanly to `apps/worker/dist` | **PASS** |
| **Worker Unit Tests** | `pnpm --filter @rumahkita/worker test` (baseline) | `0` | 30 tests, 7 suites, 30 passed, 0 failed (2.52s) | **PASS** |
| **Full E2E Runner** | `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts` | `0` | 56 tests, 19 suites, 56 passed, 0 failed (8.39s) | **PASS** |
| **Live Outbox Processing** | `SELECT status, count(*) FROM notification_events GROUP BY status` | `0` | `{ status: 'SENT', count: '24' }`, 0 stuck PENDING/PROCESSING | **PASS** |
| **Signal Traps (SIGTERM)** | Child process `proc.kill('SIGTERM')` | `0` | Clean in-flight drain, pool closed, exit code 0 | **PASS** |
| **Signal Traps (SIGINT)** | Child process `proc.kill('SIGINT')` | `0` | Clean in-flight drain, pool closed, exit code 0 | **PASS** |

---

## 6. Findings

### [Minor] Finding 1: Unused Variables & Lint Error in Test Helper
- **What:** Running `pnpm --filter @rumahkita/worker lint` reports 1 error (`no-constant-condition` at `helpers/worker-child.ts:19:14`) and 5 unused-variable warnings in the newly added challenger test files.
- **Where:** `apps/worker/src/__tests__/helpers/worker-child.ts:19` and `concurrency-stress.test.ts`.
- **Why:** `while (true)` without an eslint disable comment triggers `no-constant-condition`.
- **Suggestion:** Add `// eslint-disable-next-line no-constant-condition` to `worker-child.ts:19` and remove unused imports in test suites to keep CI lint 100% green.

### [Minor] Finding 2: Aggressive Hyphen Stripping in Phone Normalization
- **What:** `WhatsAppAdapter.normalizePhoneNumber` replaces all hyphens (`-`) across the string before inspecting the prefix. An input such as `"-- 081234567890"` has its leading dashes stripped, normalizing it to `+6281234567890`.
- **Where:** `apps/worker/src/adapters/whatsapp.adapter.ts:20`.
- **Why:** While safe from SQL injection due to ORM parameterization, phone normalization should ideally validate that only digits, whitespace, parentheses, and leading plus exist before stripping.
- **Suggestion:** Validate raw phone characters using `/^[\d\s+\-()]+$/` before stripping formatting characters.

### [Minor] Finding 3: Email Local-Part Dot Boundary
- **What:** `EMAIL_REGEX` in `EmailAdapter` allows leading or consecutive dots in email local-parts (e.g., `.user@domain.com`).
- **Where:** `apps/worker/src/adapters/email.adapter.ts:4`.
- **Why:** Strict RFC 5322 §3.4.1 dot-atom syntax forbids leading/trailing dots in local-parts.
- **Suggestion:** Refactor `validateRecipient` to use Zod's `z.string().email()` from `@rumahkita/contracts` for unified validation.

---

## 7. Verified Claims Summary

- **Claim 1:** Worker claims outbox events via `FOR UPDATE SKIP LOCKED`.  
  *Verified:* Inspected `OutboxPoller.claimBatch` and confirmed `.for('update', { skipLocked: true })` inside transaction. 10-worker concurrent stress test produced 0 race conditions.  
  *Result:* **PASS**

- **Claim 2:** External network requests to channel adapters are isolated outside DB transactions.  
  *Verified:* Inspected `daemon.ts` line 149 and `event-processor.ts`. `claimBatch` commits transaction before `Promise.allSettled(events.map(...))` triggers external dispatch.  
  *Result:* **PASS**

- **Claim 3:** Exponential backoff doubles delay ($30 \times 2^{k-1}$) and dead-letters after 5 attempts.  
  *Verified:* Unit tested `calculateExponentialBackoff` with attempts 1 to 10. Attempt 1=30s, 2=60s, 3=120s, 4=240s, 5=dead-letter (`canRetry: false`).  
  *Result:* **PASS**

- **Claim 4:** Worker daemon handles `SIGTERM` and `SIGINT` with 10s promise drain and connection pool cleanup.  
  *Verified:* Spawned subprocesses and sent OS signals; verified output logs and clean POSIX exit code 0.  
  *Result:* **PASS**

- **Claim 5:** Full E2E test runner passes 100%.  
  *Verified:* Executed `API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`. All 56 test cases across Tiers 1–4 passed with 0 failures.  
  *Result:* **PASS**

---

## 8. Final Verdict

**Verdict:** **APPROVE**  
The Milestone 5 Notification Worker Daemon implementation is robust, adheres to all architectural and PRD requirements, exhibits zero integrity violations, and passes all functional and adversarial verification criteria.
