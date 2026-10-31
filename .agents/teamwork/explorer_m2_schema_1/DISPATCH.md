## 2026-10-27T13:48:57Z
You are Explorer 1 (Database Schema Domain) for Milestone 2: Database Schema with Drizzle ORM of the RumahKita project.

Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Master Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
PRD Reference: /Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md
Survey Reference: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_backend_1/survey_report.md

Task:
1. Extract and formulate the complete TypeScript/Drizzle schema definitions for all 18 PostgreSQL tables across 8 domain files in `packages/db/src/schema/`:
   - `auth.ts`: `users`, `refresh_sessions`
   - `household.ts`: `households`, `household_members`
   - `finance.ts`: `income_sources`, `income_categories`, `expense_categories`, `incomes`, `expenses`
   - `inventory.ts`: `items`, `stock_movements`
   - `purchase.ts`: `purchases`, `purchase_items`
   - `debt.ts`: `debts_receivables`, `debt_receivable_payments`
   - `notification.ts`: `notification_preferences`, `notification_events`
   - `audit.ts`: `audit_logs`
2. Ensure strict compliance with rules:
   - Primary keys: UUID (`defaultRandom()`)
   - Monetary columns: `numeric(14, 0)`
   - Audit columns: `created_at`, `updated_at`, `created_by`, `updated_by`
   - Soft delete: `deleted_at` on master data (`income_sources`, `income_categories`, `expense_categories`, `items`)
   - Multi-tenant foreign key: `household_id` on all business tables with an index
   - Enums defined via `pgEnum`
3. Write your report to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md`.
4. Write handoff report to `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/handoff.md`.
5. Send completion message to parent orchestrator.

Constraints:
- READ-ONLY: Do not modify source code.
