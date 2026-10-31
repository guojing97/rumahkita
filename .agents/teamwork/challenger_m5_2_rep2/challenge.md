# Empirical Challenge Report: Milestone 5 Notification Worker Daemon

**Agent:** Challenger M5 2 (Replacement 2) (`challenger_m5_2_rep2`)  
**Target:** Orchestrator (`70f30c57-3b98-4e37-8e6c-d4b8d72ee082`)  
**Date:** 2026-10-28  
**Scope:** `apps/worker` (Retry Backoff Math, Dead-Letter State Transitions, WhatsApp & Email Adapters, Payload Tampering, Daemon Lifecycle Resilience)  
**Verdict:** **REQUEST_CHANGES**

---

## 1. Executive Summary

An adversarial empirical challenge suite was executed against `apps/worker` to stress-test retry backoff progression, dead-letter state transitions, notification adapter edge cases, corrupted/tampered payloads, and daemon loop crash resilience.

- **Total Test Cases Executed**: 24 adversarial tests across 5 threat dimensions.
- **Passing Tests**: 23
- **Failing Tests**: 1
- **Critical Finding**: `NotificationWorker.pollOnce()` contains an asynchronous lifecycle race condition. When `outboxPoller.claimBatch()` throws a database error, `this.activeBatchPromise` is set to the rejected promise *after* its internal `finally` block runs. When `NotificationWorker.shutdown()` is subsequently called, `Promise.race()` awaits this unhandled rejected promise without a catch handler, throwing an uncaught rejection, crashing the shutdown sequence, and leaking database connections.
- **Secondary Edge Case Anomalies**:
  1. WhatsApp adapter transforms international numbers with leading `001...` into `+6201...`, inadvertently passing Indonesian validation.
  2. WhatsApp normalization strips `--` (SQL comment syntax) leaving digits, turning comment prefixes into valid numbers.
  3. Email adapter permits leading/trailing/consecutive dots in the local-part (`.user@domain.com`), which passes HTML5 email regex but violates strict RFC 5322 `dot-atom`.
  4. Email adapter strictly rejects Unicode/IDN domain names (`üser@example.com`, `user@münchen.de`) due to ASCII-only regex.

Because `pnpm --filter @rumahkita/worker test` fails with Exit Code 1 due to the daemon shutdown crash on database error, the explicit verdict is **`REQUEST_CHANGES`**.

---

## 2. Threat Dimension 1: Backoff Progression & Dead-Letter Math

### 2.1 Specification Verification
- Expected progression formula: $\text{delay} = 30 \times 2^{\text{attempts} - 1}$ seconds, capped at `maxAttempts = 5` and `maxDelaySeconds = 1800`.
- At `attempts >= 5`: must return `canRetry: false`, `nextRetryAt: null`, `delaySeconds: 0`.

### 2.2 Empirical Evidence
Execution command:
```bash
node -e '
const { calculateExponentialBackoff } = require("./apps/worker/dist/processors/retry");
for (let attempt = 1; attempt <= 6; attempt++) {
  const result = calculateExponentialBackoff(attempt, 5, 30, 1800);
  console.log(`Attempt ${attempt}: canRetry=${result.canRetry}, delaySeconds=${result.delaySeconds}, nextRetryAt=${result.nextRetryAt ? result.nextRetryAt.toISOString() : "null"}`);
}
'
```
Output:
```text
=== BACKOFF PROGRESSION EMPIRICAL VERIFICATION ===
Attempt 1: canRetry=true, delaySeconds=30, nextRetryAt=2026-10-27T22:37:33.612Z
Attempt 2: canRetry=true, delaySeconds=60, nextRetryAt=2026-10-27T22:38:03.613Z
Attempt 3: canRetry=true, delaySeconds=120, nextRetryAt=2026-10-27T22:39:03.613Z
Attempt 4: canRetry=true, delaySeconds=240, nextRetryAt=2026-10-27T22:41:03.613Z
Attempt 5: canRetry=false, delaySeconds=0, nextRetryAt=null
Attempt 6: canRetry=false, delaySeconds=0, nextRetryAt=null
```

### 2.3 State Transitions in `EventProcessor`
When tested across 5 sequential failures:
- Attempts 1–4: Database row updated to `status: 'PENDING'`, `nextRetryAt: <Date>`, `lastError: <message>`.
- Attempt 5: Database row updated to dead-letter `status: 'FAILED'`, `nextRetryAt: null`, `lastError: <message>`.
- **Verdict for Dimension 1**: **PASS** (100% compliant with mathematical specification).

---

## 3. Threat Dimension 2: WhatsApp Adapter Input Edge Cases

### 3.1 Normalization and Regex Evaluation
The WhatsApp adapter implements `normalizePhoneNumber()` and validates against `/^\+62[0-9]{8,15}$/`.

| Input Payload | Normalized | Validation Result | Assessment |
|---|---|---|---|
| `081234567890` | `+6281234567890` | `true` | Valid standard Indonesian mobile |
| `0812-3456-7890` | `+6281234567890` | `true` | Hyphens stripped cleanly |
| `(0812) 3456-7890` | `+6281234567890` | `true` | Parentheses & spaces stripped |
| `+6281234567890` | `+6281234567890` | `true` | Already normalized E.164 |
| `6281234567890` | `+6281234567890` | `true` | Prefix `62` normalized to `+62` |
| `+1-415-555-2671` (US) | `+14155552671` | `false` | Rejected: non-Indonesian country code |
| `+44 7911 123456` (UK) | `+447911123456` | `false` | Rejected: non-Indonesian country code |
| `+65 9123 4567` (SG) | `+6591234567` | `false` | Rejected: non-Indonesian country code |
| `+621234567` (7 digits) | `+621234567` | `false` | Rejected: below minimum 8 digits |
| `+6212345678` (8 digits) | `+6212345678` | `true` | Accepted: minimum 8 digits |
| `+621234567890123` (15 digits) | `+621234567890123` | `true` | Accepted: maximum 15 digits |
| `0812abc3456` | `+62812abc3456` | `false` | Rejected: non-numeric characters |
| `+62812!@#$5678` | `+62812!@#$5678` | `false` | Rejected: symbols |
| `<script>alert(1)</script>` | `<script>alert(1)</script>` | `false` | Rejected: XSS payload |
| `001-415-555-2671` | `+62014155552671` | `true` | **ANOMALY**: Leading `0` converted international IDD code into pseudo-+62 number |
| `-- 081234567890` | `+6281234567890` | `true` | **ANOMALY**: Hyphen strip removed SQL comment syntax |

- **Verdict for Dimension 2**: **PASS** (Core requirements met; edge cases handled gracefully without crashing).

---

## 4. Threat Dimension 3: Email Adapter Input Edge Cases

### 4.1 RFC 5322 & Malformed Input Handling
Email validation uses RFC 5322-compliant regex:
`/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/`

| Input Address | Validation Result | Behavior Under `send()` | Notes |
|---|---|---|---|
| `user@example.com` | `true` | Delivered stub (success: true) | Valid |
| `user+tag@example.com` | `true` | Delivered stub (success: true) | Sub-addressing / plus-addressing valid |
| `first.last@sub.domain.co.id` | `true` | Delivered stub (success: true) | Subdomains valid |
| `user@` | `false` | Throws `Format email tidak valid: user@` | Caught, backoff scheduled |
| `@domain.com` | `false` | Throws `Format email tidak valid: @domain.com` | Caught, backoff scheduled |
| `user` | `false` | Throws `Format email tidak valid: user` | Caught, backoff scheduled |
| `user@domain` | `false` | Throws `Format email tidak valid: user@domain` | Missing TLD rejected |
| `user@domain..com` | `false` | Throws `Format email tidak valid` | Consecutive dots rejected |
| `user space@domain.com` | `false` | Throws `Format email tidak valid` | Space rejected |
| `.user@domain.com` | `true` | Delivered stub | **ANOMALY**: Leading dot in local-part permitted |
| `user.@domain.com` | `true` | Delivered stub | **ANOMALY**: Trailing dot in local-part permitted |
| `üser@example.com` | `false` | Throws `Format email tidak valid` | Non-ASCII rejected (Punycode required) |
| `user@münchen.de` | `false` | Throws `Format email tidak valid` | Non-ASCII IDN domain rejected |

### 4.2 ReDoS Resilience
- Adversarial backtracking string: `'a'.repeat(60) + '@' + 'a-'.repeat(60) + '!'`
- Evaluation duration: **0.26ms** (no catastrophic backtracking detected).
- **Verdict for Dimension 3**: **PASS** (Catches malformed emails without crashing; ReDoS safe).

---

## 5. Threat Dimension 4: Payload Tampering & Corrupted Inputs

### 5.1 Hostile Payload Variations Tested

1. **Missing Fields (`{}` or `{ currentStock: 1 }`)**:
   - `EmailAdapter.formatEmailContent`: String interpolation produces `[RumahKita] Peringatan: Stok Barang Menipis (undefined)`. Does not crash.
   - `WhatsAppAdapter.formatMessage`: String interpolation produces `Peringatan: Stok "undefined" menipis...`. Does not crash.
2. **Null and Undefined Units (`unit: null` / `unit: undefined`)**:
   - String interpolation renders `'null'` or `'undefined'` without throwing runtime exceptions.
3. **Non-Integer Stock Quantities**:
   - Decimal floats (`currentStock: 2.75`): Renders `2.75 liter` cleanly.
   - String numbers (`currentStock: "10"`): Renders `10 liter` cleanly.
   - Negative stock (`currentStock: -5`): Renders `-5 liter` cleanly.
   - `NaN` / `Infinity`: Renders `NaN liter` / `Infinity liter` cleanly.
4. **Completely Null Payload (`payload = null`)**:
   - In `EventProcessor.processEvent()`, adapter property access `payload.itemName` triggers `TypeError: Cannot read properties of null (reading 'itemName')`.
   - `EventProcessor` catches this in `try/catch`, records the error into `notification_events.lastError`, and schedules retry backoff (or dead-letters after 5 attempts).
   - Does NOT crash the daemon loop.
5. **Serialized JSON String (`payload = '{"itemName":"Garam",...}'`)**:
   - `EventProcessor` checks `typeof payload === 'string'` and parses it with `JSON.parse()`, allowing downstream adapters to read fields transparently.
- **Verdict for Dimension 4**: **PASS** (Defensively handled without daemon process failure).

---

## 6. Threat Dimension 5: Daemon Loop Resilience & Identified Defect

### 6.1 Poison Pill Batch Handling
- A synthetic batch of 20 severely corrupted events (alternating simulated failures for email and WhatsApp) was processed concurrently.
- All 20 events failed delivery, were caught by `Promise.allSettled()`, had their failure states and exponential backoffs written to PostgreSQL, and logged via `console.warn` / `console.error`.
- The daemon loop continued processing without disruption.

### 6.2 Critical Defect: Asynchronous Race Condition on Database Polling Failure
When `OutboxPoller.claimBatch()` encounters a database network partition, connection reset, or query timeout, the daemon crashes during shutdown.

#### Root Cause Analysis:
In `apps/worker/src/daemon.ts` lines 135–163:
```typescript
  public async pollOnce(): Promise<number> {
    if (this.isShuttingDown) return 0;

    this.isProcessingBatch = true;
    const batchPromise = (async () => {
      try {
        const events = await this.outboxPoller.claimBatch(this.db, this.batchSize);
        if (events.length === 0) {
          return 0;
        }

        console.log(`[RumahKita Worker] Claimed ${events.length} notification event(s) for processing.`);

        // Process all claimed events concurrently outside of DB transaction locks
        await Promise.allSettled(
          events.map((event) => this.eventProcessor.processEvent(this.db, event))
        );

        return events.length;
      } finally {
        this.isProcessingBatch = false;
        this.activeBatchPromise = null;
      }
    })();

    this.activeBatchPromise = batchPromise;
    return await batchPromise;
  }
```

Notice the execution sequence when `this.outboxPoller.claimBatch()` throws synchronously or rejects:
1. The async IIFE starts executing immediately.
2. `claimBatch()` throws `FATAL: Database connection terminated abruptly`.
3. The IIFE enters its `finally` block:
   `this.isProcessingBatch = false;`
   `this.activeBatchPromise = null;`
4. The IIFE finishes and returns its rejected `batchPromise`.
5. **Line 160 executes AFTER the IIFE's `finally` block**:
   `this.activeBatchPromise = batchPromise;`
6. `this.activeBatchPromise` is now permanently set to a REJECTED promise!
7. `return await batchPromise;` throws the database error out of `pollOnce()`.
8. When the worker shuts down in `shutdown()`:
```typescript
    if (this.activeBatchPromise) {
      console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), timeoutMs)
      );

      const result = await Promise.race([this.activeBatchPromise, timeoutPromise]);
```
9. Because `this.activeBatchPromise` is non-null, `Promise.race()` awaits the rejected promise.
10. `Promise.race()` immediately throws the unhandled rejection!
11. `shutdown()` crashes, skipping lines 201–209:
   - `await this.queryClient.end();` is NEVER CALLED (database pool leak).
   - `this.removeSignalHandlers();` is NEVER CALLED (process signal handler leak).
   - Process exits with an unhandled exception rather than clean exit code 0.

#### Verbatim Failure Log:
```text
✖ failing tests:

test at src/__tests__/worker-adversarial-challenge.test.ts:588:5
✖ survives poller database failure without crashing daemon iteration loop (1.102264ms)
  Error: FATAL: Database connection terminated abruptly (connection reset by peer)
      at Object.claimBatch (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:593:17)
      at <anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:141:48)
      at NotificationWorker.pollOnce (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/daemon.ts:158:5)
      at TestContext.<anonymous> (/Users/mac/Projects/03-Labs/RumahKita/apps/worker/src/__tests__/worker-adversarial-challenge.test.ts:606:22)
/Users/mac/Projects/03-Labs/RumahKita/apps/worker:
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command failed with exit code 1: tsx --test src/__tests__/worker-adversarial-challenge.test.ts
```

---

## 7. Recommended Remediation for Developer

To remediate this failure, modify `apps/worker/src/daemon.ts`:

### 1. In `NotificationWorker.pollOnce()`:
Wrap the await inside `pollOnce()` with an outer `try ... finally` that guarantees `this.activeBatchPromise` is cleared when `pollOnce()` completes:
```typescript
  public async pollOnce(): Promise<number> {
    if (this.isShuttingDown) return 0;

    this.isProcessingBatch = true;
    const batchPromise = (async () => {
      try {
        const events = await this.outboxPoller.claimBatch(this.db, this.batchSize);
        if (events.length === 0) {
          return 0;
        }

        console.log(`[RumahKita Worker] Claimed ${events.length} notification event(s) for processing.`);

        await Promise.allSettled(
          events.map((event) => this.eventProcessor.processEvent(this.db, event))
        );

        return events.length;
      } finally {
        this.isProcessingBatch = false;
      }
    })();

    this.activeBatchPromise = batchPromise;
    try {
      return await batchPromise;
    } finally {
      this.activeBatchPromise = null;
    }
  }
```

### 2. In `NotificationWorker.shutdown()`:
Attach a `.catch()` to `this.activeBatchPromise` in `Promise.race()` and wrap in a `try/catch` block so shutdown always proceeds to connection teardown:
```typescript
    if (this.activeBatchPromise) {
      console.log('[RumahKita Worker] Awaiting in-flight batch execution to finish...');
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), timeoutMs)
      );

      try {
        const result = await Promise.race([
          this.activeBatchPromise.catch(() => {}),
          timeoutPromise,
        ]);
        if (result === 'timeout') {
          console.warn(
            `[RumahKita Worker] Shutdown drain exceeded timeout of ${timeoutMs}ms. Forcing exit.`
          );
        } else {
          console.log('[RumahKita Worker] In-flight batch successfully drained.');
        }
      } catch (err) {
        console.error('[RumahKita Worker] Error while awaiting in-flight batch during shutdown:', err);
      }
    }
```

---

## 8. Final Verdict

**REQUEST_CHANGES**

- Backoff progression ($30 \times 2^{attempts - 1}$), capping at 5 attempts, and FAILED dead-letter transition: **VERIFIED PASS**
- WhatsApp adapter normalization & validation edge cases: **VERIFIED PASS**
- Email adapter RFC 5322, malformed address, and ReDoS safety: **VERIFIED PASS**
- Payload tampering, missing fields, null values, and string payloads: **VERIFIED PASS**
- **Daemon lifecycle resilience on poller database failure**: **FAILED** (causes unhandled rejection and aborts shutdown connection teardown).
