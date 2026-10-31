# Orchestrator Master Plan — RumahKita MVP

## 1. Survey Phase
- Spawn 3 parallel Explorers / Spec Miners:
  - Explorer 1 (Specification Miner): Map PRD (§9 entities, §10 API endpoints, §11 business rules, acceptance criteria) into detailed requirements.
  - Explorer 2 (Frontend Spec Miner): Map Design Spec (`Doc/design.md`) into neo-brutalism design system, pages, components, mobile-desktop layout, forms, validation rules.
  - Explorer 3 (Architecture & Monorepo Explorer): Map workspace layout, package dependencies, Drizzle ORM setup, NestJS modules, Next.js App Router BFF proxy, worker polling model, and test strategy.
- Merge reports into `PROJECT.md` Feature Inventory and Interface Contracts.

## 2. Dual Track Execution

### Track A: E2E Testing Track (Independent & Opaque-Box)
- Spawn E2E Testing Sub-orchestrator / Workers to create:
  - Test runner infrastructure (`TEST_INFRA.md`)
  - Tier 1: Feature Coverage (≥5 per feature)
  - Tier 2: Boundary & Corner Cases (≥5 per feature)
  - Tier 3: Cross-Feature Interactions
  - Tier 4: Real-World Scenarios
- Publish `TEST_READY.md`.

### Track B: Implementation Track
- **M1: Monorepo Foundation**: Turborepo, pnpm workspace, `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/contracts`, `packages/ui`, docker-compose for PostgreSQL, root build/dev scripts.
- **M2: Database Schema & Drizzle ORM**: 18 PostgreSQL tables, UUID PKs, `numeric(14,0)` IDR, audit columns, soft delete, Drizzle schema, migrations, seed script.
- **M3: Backend API (NestJS)**: `/api/v1` REST endpoints, JWT auth + refresh cookies, household membership guard, CRUD, atomic purchase transactions, stock adjustments, debts/receivables, dashboard/reports, CSV export, Swagger.
- **M4: Frontend (Next.js App Router)**: Neo-brutalism UI tokens & layout, login, dashboard, income/expense/inventory/debts pages, purchase flow with item combobox & stock impact preview, TanStack Table desktop / card mobile, Recharts, React Hook Form + Zod, 390px-1280px responsiveness.
- **M5: Notification Worker & Final E2E Hardening**: Outbox consumer polling `notification_events`, status transitions, Phase 1 pass 100% E2E tests, Phase 2 white-box adversarial hardening.

## 3. Gating & Verification
- Strict gate on each milestone: Build/test pass + Reviewers approve + Challengers approve + Auditor CLEAN (Binary Veto).
