## 2026-10-27T12:42:05Z
You are the E2E Test Writer for the RumahKita project (Dual Track: E2E Testing Track).

Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/test_writer_e2e_1
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Master Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
Architecture Reference: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_survey_arch_3/survey_report.md
Backend Spec: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1/survey_report.md

Task & Objective:
1. Thoroughly read ORIGINAL_REQUEST.md and the survey reports.
2. Formulate and write the test architecture document:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/TEST_INFRA.md`
   (and `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/orchestrator_1/TEST_INFRA.md`)
   following the Dual Track E2E Testing Track specifications.
3. Scaffold and author the comprehensive, opaque-box E2E test suite in `tests/e2e/`:
   - Design an opaque-box test runner (e.g. using Vitest / Jest / TypeScript HTTP test runner against API base URL `http://localhost:3001/api/v1`).
   - Implement Tier 1: Feature Coverage tests (Auth login/refresh, Income CRUD, Expense CRUD, Item CRUD, Purchase flow, Debt/Receivable flow, Dashboard, Reports).
   - Implement Tier 2: Boundary & Corner Cases (nominal <= 0, missing category 422, missing stock adjustment reason 422, negative stock prevention, debt payment exceeding balance 422, cross-household 403, expired tokens 401).
   - Implement Tier 3: Cross-Feature Combinations (Purchase completion generating expense and incrementing item stock; Debt payment updating status from Active -> PartiallyPaid -> Settled; Outbox notification event creation on safe->low transition).
   - Implement Tier 4: Real-world user application scenarios (full household monthly cycle: income entry -> expense entry -> grocery purchase -> stock check -> debt payment -> monthly report reconciliation).
4. Once all test cases and runner infrastructure are written, create:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/TEST_READY.md`
   (and `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/orchestrator_1/TEST_READY.md`)
   summarizing test counts by tier, feature checklist, and the command to run the suite.
5. Write your handoff report to:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/test_writer_e2e_1/handoff.md`
6. Send completion message to parent orchestrator.

Constraints:
- Opaque-box: derive tests from user requirements and API specifications, NOT implementation internals.
- Do NOT modify product implementation code in apps/ or packages/db. Only write test files under tests/e2e/ and metadata files under .agents/teamwork/.
- Tests must use standard exit code 0 for pass and non-zero for fail.
