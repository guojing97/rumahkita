# Adversarial Challenge & Verification Report: Milestone 5 Worker Remediation

**Agent:** Challenger M5 2 (Remediation Verifier) (`challenger_m5_2_rep3`)  
**Target:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`)  
**Date:** 2026-10-28  
**Scope:** Remediation verification of `apps/worker/src/daemon.ts` and `apps/worker/src/polling/outbox-poller.ts`, focusing on defect resolution at `worker-adversarial-challenge.test.ts:588`, isolated reproduction validation, and full E2E test suite execution.  
**Verdict:** **APPROVE**

---

## Challenge Summary

**Overall risk assessment:** **LOW** (Remediation verified; all defects completely resolved with empirical proof).

The defect identified in `challenger_m5_2_rep2`—where a database poller failure left an unhandled rejection in `this.activeBatchPromise`, crashing `worker.shutdown()` and preventing clean database pool termination—has been completely resolved. In `apps/worker/src/daemon.ts`, `pollOnce()` now wraps `batchPromise` in a robust `try ... finally` block ensuring `this.activeBatchPromise = null` unconditionally on all exit paths, and `shutdown()` protects `Promise.race` with `.catch(() => {})`, `try/catch`, and timeout cleanup. Furthermore, `outbox-poller.ts` incorporates PostgreSQL `NOW()` clock skew immunity and an atomic zombie sweeper for expired `PROCESSING` rows at `attempts >= maxAttempts`.

All 65 worker unit and adversarial challenge tests pass cleanly (100% pass rate), the isolated failure reproduction script now executes with zero unhandled rejections and clean DB closure, and all 56 E2E tests across Tiers 1–4 pass cleanly with 100% success rate.

---

## Challenges

### [Low] Challenge 1: Worker Shutdown Under In-Flight Batch Processing and Database Cleanup
- **Assumption challenged:** When `worker.shutdown()` is called while an in-flight polling iteration is executing, or when the in-flight task throws a database error, the worker must cleanly drain or timeout, release database connection pools via `queryClient.end()`, and remove signal listeners without leaving hanging timers or leaking connections.
- **Attack scenario:**
  1. Trigger an abrupt database disconnection during `outboxPoller.claimBatch()`.
  2. Invoke `worker.shutdown()` immediately after failure or during in-flight processing.
  3. Verify whether `this.activeBatchPromise` causes unhandled rejection, or if `queryClient.end()` is bypassed.
  4. Simulate hung tasks to verify whether `shutdownTimeoutMs` enforces bounded termination.
- **Blast radius:** If unhandled, background Node.js processes exit abruptly on SIGTERM or leak PostgreSQL connection pools, exhausting server connection limits.
- **Mitigation verified:**
  - In `apps/worker/src/daemon.ts` (lines 162–168), `pollOnce()` executes:
    ```typescript
    this.activeBatchPromise = batchPromise;
    try {
      return await batchPromise;
    } finally {
      this.activeBatchPromise = null;
      this.isProcessingBatch = false;
    }
    ```
  - In `apps/worker/src/daemon.ts` (lines 191–218), `shutdown()` wraps the race in `.catch(() => {})`, ensures timeout cleanup via `clearTimeout(timeoutTimer)`, and wraps `queryClient.end()` in an isolated `try/catch` block.
- **Result:** **PASSED**. Both the adversarial test suite and independent stress harnesses verify zero leaks and clean teardown.

---

## Stress Test Results

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| 1 | `worker-adversarial-challenge.test.ts:588`: Database connection reset during `claimBatch()` | `pollOnce()` propagates error; `shutdown()` drains without unhandled rejection; DB pool closed | `survives poller database failure without crashing daemon iteration loop` passed in 0.81ms; clean shutdown logged | **PASS** |
| 2 | Isolated Reproduction Script: Failing poller + immediate `worker.shutdown()` | `worker.shutdown()` completes without throwing; database connections closed cleanly | Zero thrown errors; `Database connections closed cleanly.` logged; exit code 0 | **PASS** |
| 3 | Full Worker Unit & Adversarial Test Suite (`pnpm --filter @rumahkita/worker test`) | All 65 tests pass cleanly across 14 test suites | 65 passed, 0 failed, duration 5.14s | **PASS** |
| 4 | Worker Typecheck & Lint (`pnpm --filter @rumahkita/worker typecheck && pnpm lint`) | 0 TypeScript errors, 0 ESLint warnings | 0 errors, 0 warnings; exit code 0 | **PASS** |
| 5 | Full Opaque-Box E2E Runner (`API_BASE_URL=http://localhost:4000/api/v1 node tests/e2e/runner.ts`) | All 56 tests across Tiers 1–4 pass with 100% success rate | 56 passed, 0 failed, 19 suites, exit code 0 | **PASS** |
| 6 | Custom Empirical Stress 1: In-flight batch delayed by 80ms while `shutdown()` is called | Shutdown awaits in-flight batch completion before closing database pool | In-flight batch finished; `queryClient.end()` called after batch completion | **PASS** |
| 7 | Custom Empirical Stress 2: Indefinitely hung batch with fast 100ms shutdown timeout | Shutdown times out at 100ms, logs warning, and closes DB pool without hanging | Timed out in 102ms; DB pool closed; process resumed cleanly | **PASS** |
| 8 | Custom Empirical Stress 3: `queryClient.end()` connection error during shutdown | Error caught and logged; daemon exits gracefully without unhandled rejection | Caught and logged: `Error closing database connections`; no unhandled rejection | **PASS** |
| 9 | Custom Empirical Stress 4: Multiple concurrent `worker.shutdown()` calls | Re-entrant shutdown calls are idempotent; `queryClient.end()` called exactly once | Called once; clean exit | **PASS** |

---

## Unchallenged Areas

- **Live Third-Party Delivery Gateways (Resend / WhatsApp Cloud API):** In accordance with the PRD §R5 requirements, delivery channels currently use structured logging delivery stubs with deterministic test hooks. Live external network calls will be exercised when production API keys are configured.
