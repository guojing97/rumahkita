# BRIEFING — 2026-10-27T14:38:30Z

## Mission
Produce an exhaustive specification for Authentication and Multi-Tenancy in `apps/api/src/modules/auth/` and `household/` for Milestone 3 (Backend API NestJS /api/v1).

## 🔒 My Identity
- Archetype: explorer (Specification Miner)
- Roles: Teamwork specialist, specification miner, external domain expert
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2
- Original parent: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Milestone: Milestone 3 - Backend API (NestJS REST API /api/v1)

## 🔒 Key Constraints
- Do NOT implement application source code (read-only specification miner).
- Prioritize authoritative specification sources over LLM prior knowledge.
- Must document all features, edge cases, error conditions, inputs, and outputs.
- Write auth spec to `auth_spec.md` in working directory.
- Must follow 5-component handoff report protocol in `handoff.md`.
- Communicate completion to parent via `send_message`.

## Current Parent
- Conversation ID: c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb
- Updated: 2026-10-27T14:38:30Z

## Task Summary
- **What to build**: Auth & Multi-tenancy specification document (`auth_spec.md`) and handoff report (`handoff.md`).
- **Success criteria**: Comprehensive endpoints spec, guard contracts, multi-tenancy verification rules, DTOs, Argon2id & JWT refresh rotation flow, edge cases, status codes, and database schema alignment.
- **Interface contracts**: `packages/contracts/src/auth/auth.schema.ts`, `packages/db/src/schema/auth.ts`, `packages/db/src/schema/household.ts`.
- **Code layout**: `apps/api/src/modules/auth/`, `apps/api/src/modules/household/`, `apps/api/src/common/guards/`.

## Loaded Skills
- **Source**: `/Users/mac/.gemini/config/skills/backend-developer/SKILL.md`
- **Local copy**: `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m3_auth_2/backend_developer_skill.md`
- **Core methodology**: Clean architecture, secure auth patterns (Argon2id, refresh token rotation, OWASP), strict DTO validation, transaction safety, defensive error handling.

## Key Decisions Made
- Confirmed cookie name is `refreshToken` as required by opaque-box E2E tests, while supporting fallback to `refresh_token`.
- Standardized refresh token storage as SHA-256 hash in `refresh_sessions.token_hash` with `family_id` lineage tracking for token reuse detection.
- Specified Argon2id hashing with `memoryCost: 65536, timeCost: 3, parallelism: 4` via `@node-rs/argon2`.
- Household Module designed to serve both `GET /household` (singleton active profile expected by PRD §10 and E2E tests) and `/households/*` (collection routes).

## Artifact Index
- `DISPATCH.md` — Original dispatch assignment
- `BRIEFING.md` — Persistent state and identity
- `progress.md` — Liveness and execution heartbeat
- `backend_developer_skill.md` — Local copy of backend developer skill
- `auth_spec.md` — Exhaustive Auth & Multi-Tenancy specification
- `handoff.md` — 5-component handoff report
