# BRIEFING — 2026-10-27T13:56:00Z

## Mission
Extract and formulate the complete TypeScript/Drizzle schema definitions for all 18 PostgreSQL tables across 8 domain files in `packages/db/src/schema/` per PRD, Original Request, and architectural standards.

## 🔒 My Identity
- Archetype: SPECIFICATION MINER / Explorer
- Roles: Database Schema Specification Miner
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1
- Original parent: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Milestone: Milestone 2: Database Schema with Drizzle ORM

## 🔒 Key Constraints
- READ-ONLY: Do not modify source code. Only write within `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/`.
- Primary keys: UUID (`defaultRandom()`).
- Monetary columns: `numeric(14, 0)` (integer Rupiah, never float).
- Audit columns: `created_at`, `updated_at`, `created_by`, `updated_by` on business tables.
- Soft delete: `deleted_at` on master data (`income_sources`, `income_categories`, `expense_categories`, `items`).
- Multi-tenant foreign key: `household_id` on all business tables with an index.
- Enums defined via `pgEnum`.
- Complete interface enumeration: tables, columns, data types, constraints, defaults, indexes, foreign keys, relationships.

## Current Parent
- Conversation ID: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Updated: 2026-10-27T13:56:00Z

## Task Summary
- **What to build**: Comprehensive database schema specification (`schema_spec.md`) and handoff report (`handoff.md`).
- **Success criteria**: Exact schema definitions for 18 tables across 8 domain files with accurate types, indexes, FK cascades, enums, and edge case coverage.
- **Interface contracts**: `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md`, `/Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md`.
- **Code layout**: `packages/db/src/schema/` (8 files: `auth.ts`, `household.ts`, `finance.ts`, `inventory.ts`, `purchase.ts`, `debt.ts`, `notification.ts`, `audit.ts`, plus `shared.ts`, `relations.ts`, `index.ts`).

## Loaded Skills
- **Source**: none explicitly requested
- **Local copy**: none
- **Core methodology**: Drizzle ORM schema modeling, PostgreSQL constraints, multi-tenant isolation, UUID PKs, numeric(14,0) monetary representation.

## Key Decisions Made
- All 18 tables mapped across 8 domain files with shared helpers in `shared.ts` and relations in `relations.ts` to eliminate circular dependency issues between finance and purchases.
- Partial unique indexes applied on master data: `(household_id, name) WHERE deleted_at IS NULL`.
- Monetary columns strictly typed as `numeric(14, 0)`.
- Enums aligned with contracts definitions (`payment_method`, `household_role`, `stock_movement_reason`, `purchase_status`, `debt_type`, `debt_status`, `notification_channel`, `notification_status`).

## Artifact Index
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/schema_spec.md` — Complete Drizzle ORM schema specification for all 18 tables across 8 files
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/handoff.md` — 5-component handoff report for parent orchestrator
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/progress.md` — Progress tracker
- `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m2_schema_1/DISPATCH.md` — Dispatch log
