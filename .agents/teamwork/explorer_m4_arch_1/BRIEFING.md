# BRIEFING — 2026-10-27T18:06:30Z

## Mission
Produce comprehensive technical specification (arch_spec.md) for Milestone 4 (Frontend Web with Next.js App Router: BFF Proxy, Responsive Neo-Brutalist Layout, Auth & Household Context).

## 🔒 My Identity
- Archetype: explorer
- Roles: technical specification, frontend architecture, design system, API proxying
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1
- Original parent: b7285ab7-91ac-41dd-b752-01f7c3a3dbb1
- Milestone: Milestone 4 (Frontend Web with Next.js App Router)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Design neo-brutalism responsive layout (390px - 1280px)
- BFF proxy with HttpOnly refresh token cookie, Authorization Bearer, X-Household-Id
- Layout & navigation specifications for desktop & mobile
- Auth & household context specification

## Current Parent
- Conversation ID: b7285ab7-91ac-41dd-b752-01f7c3a3dbb1
- Updated: 2026-10-27T18:01:00Z

## Investigation State
- **Explored paths**:
  - `apps/web` (Next.js 14 App Router, package.json, layout.tsx, globals.css, build output)
  - `packages/ui` (neoBrutalismPreset, tokens/neo-brutalism.css, Button, Input, Card, Badge)
  - `packages/contracts` (auth.schema.ts, api-response.ts, idr.ts)
  - `apps/api` (auth.service.ts, auth.controller.ts, household.guard.ts, http-exception.filter.ts, transform.interceptor.ts)
  - `doc/design.md` and `doc/prd.md`
- **Key findings**:
  - NestJS uses cookie named `refreshToken` (accepts `refresh_token` as fallback), 7 days, HttpOnly, SameSite=Lax.
  - Multi-tenancy guard strictly enforces `x-household-id` header or fallback.
  - In-memory JWT access token prevents XSS vulnerability; client fetcher handles silent 401 refresh with request queueing.
  - Desktop layout uses 240px fixed left sidebar with active navigation in neon lime (`bg-primary`, 2px ink border, 4px shadow).
  - Mobile layout uses 56px sticky top bar + 64px fixed 5-item bottom nav bar with `pb-24` padding reservation.
- **Unexplored areas**: None for architecture exploration. Ready for implementation workers.

## Key Decisions Made
- Catch-all route handler `apps/web/src/app/api/[...path]/route.ts` bridging `/api/*` to NestJS `http://127.0.0.1:4000/api/v1`.
- Typed `ApiClientError` and transparent 401 token refresh queueing in `apps/web/src/lib/api-fetcher.ts`.
- In-memory access token storage in `AuthProvider`; active household persisted in `localStorage`.
- Next.js Edge Middleware for session protection based on `refreshToken` cookie.
- Full architectural specification written to `arch_spec.md`.

## Artifact Index
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/DISPATCH.md — Dispatch instructions
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/BRIEFING.md — Working memory and identity
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/progress.md — Heartbeat and status
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md — Complete architectural specification
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/handoff.md — 5-component handoff report
