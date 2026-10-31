## 2026-10-27T18:00:29Z
You are explorer_m4_arch_1 for Milestone 4 (Frontend Web with Next.js App Router) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1

Authoritative user request (MUST READ FIRST):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Design Spec & PRD:
- /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
- /Users/mac/Projects/03-Labs/RumahKita/doc/prd.md

Backend API Reference:
- /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m3_api_2/handoff.md

Contracts:
- /Users/mac/Projects/03-Labs/RumahKita/packages/contracts

Mission:
Explore and produce a comprehensive technical specification (`arch_spec.md`) in your working directory covering:
1. BFF Proxy Architecture:
   - Next.js route handlers (`/api/[...path]/route.ts` or individual proxy endpoints) forwarding client requests to NestJS (`http://127.0.0.1:4000/api/v1`).
   - Handling JWT access token, `X-Household-Id` header, and forwarding HttpOnly `refresh_token` cookies securely.
   - Client API fetcher / query wrapper with automatic error parsing using the standard backend error envelope.
2. Layout & Responsive Navigation Architecture (390px - 1280px):
   - Root layout (`app/layout.tsx`), fonts (Inter/Plus Jakarta Sans), Neo-brutalism theme root CSS variables.
   - Desktop Layout (>=1024px): 240px fixed left sidebar with logo, household switcher, navigation links with active state indicator (neon lime background, 2px ink border, 4px shadow), and user profile badge.
   - Mobile Layout (<1024px, 390px base): 56px sticky top bar with household dropdown + 64px fixed 5-item bottom navigation bar (Dashboard, Transaksi, Belanja, Inventori, Lainnya/Menu).
3. Auth & Household Context:
   - Auth store / context (`AuthProvider`, `useAuth`, `useHousehold`), login page (`/login`), redirect logic for unauthenticated users.
4. Output your detailed specification in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md` and send a completion message to orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
