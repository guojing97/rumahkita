# BRIEFING — 2026-10-28T01:38:00Z

## Mission
Implement and verify Milestone 4 (Frontend Web with Next.js App Router, Neo-brutalism UI, BFF Proxy, TanStack tables/cards, Recharts, and all 7 core pages) for RumahKita MVP.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1
- Original parent: b7285ab7-91ac-41dd-b752-01f7c3a3dbb1
- Milestone: Milestone 4 (Frontend Web)

## 🔒 Key Constraints
- Neo-brutalism design tokens: `--bg: #FFFDF7`, `--ink: #171717`, `--primary: #C8F169`, surfaces `#FFFFFF`, borders 2px solid `#171717`, box-shadow `4px 4px 0px #171717`.
- Badges: `Aman ✓` (#D1FAE5/#065F46), `Menipis ⚠` (#FEF3C7/#92400E), `Habis ✕` (#FEE2E2/#991B1B).
- Write ownership: `apps/web/` exclusively (and `packages/ui/` if necessary).
- BFF Proxy Route Handler at `apps/web/src/app/api/[...path]/route.ts` proxies to NestJS (`http://127.0.0.1:4000/api/v1`), forwarding auth headers/cookies and supporting CSV streaming.
- 7 Core Pages: `/login`, `/dashboard`, `/transaksi`, `/belanja`, `/inventori`, `/hutang`, `/laporan`, `/pengaturan`.
- Responsive navigation: 240px fixed left sidebar on desktop (>=1024px), 56px sticky top bar + 64px fixed 5-item bottom nav on mobile (<1024px, 390px base).
- Mobile reflow: tables convert to cards on mobile (<768px). Modals adapt to bottom sheets or responsive dialogs.
- Clean typecheck, build, and lint.

## Current Parent
- Conversation ID: b7285ab7-91ac-41dd-b752-01f7c3a3dbb1
- Updated: 2026-10-28T01:38:00Z

## Task Summary
- **What to build**: Next.js App Router frontend web application for RumahKita household finance & inventory MVP.
- **Success criteria**: All 7 core pages functional, Neo-brutalism design system active, BFF proxy handler routing to backend, responsive desktop/mobile reflows, typecheck/build/lint cleanly passing.
- **Interface contracts**: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md, /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2/design_spec.md, /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3/pages_spec.md
- **Code layout**: apps/web/

## Key Decisions Made
- Used `@tanstack/react-table` v8 for stable table and sorting model in Next.js 14 App Router.
- Wrapped `useSearchParams()` in `apps/web/src/app/(auth)/login/page.tsx` with a `<Suspense>` boundary to ensure clean static page generation.
- Implemented edge-compatible BFF proxy at `apps/web/src/app/api/[...path]/route.ts` supporting binary/text streaming, Set-Cookie forwarding, and custom tenant/idempotency headers.
- Implemented custom Neo-brutalism UI primitives (`IDRInput`, `Select`, `Dialog`) ensuring strict adherence to 2px solid borders, unblurred hard shadows (`4px 4px 0px #171717`), and 44px+ mobile touch targets.
- Preserved zero-continuity on 12-month reports by defaulting missing months to 0 income/expense for accurate Recharts visualization.

## Artifact Index
- apps/web/src/app/api/[...path]/route.ts — BFF Proxy Route Handler
- apps/web/src/lib/api-fetcher.ts — API Fetcher with silent refresh queue
- apps/web/src/lib/api-client.ts — API client error normalization
- apps/web/src/contexts/auth-context.tsx — Auth state and token lifecycle
- apps/web/src/contexts/household-context.tsx — Household tenancy context
- apps/web/src/middleware.ts — Edge route guard
- apps/web/src/components/ui/ — IDRInput, Select, Dialog
- apps/web/src/components/layout/ — DesktopSidebar, MobileTopBar, MobileBottomNav, MoreMenuDrawer, HouseholdSwitcher, UserBadge
- apps/web/src/app/(auth)/login/page.tsx — Login page
- apps/web/src/app/(dashboard)/layout.tsx — Authenticated shell layout (with pb-24 mobile padding)
- apps/web/src/app/(dashboard)/dashboard/page.tsx — Dashboard with stat cards & charts
- apps/web/src/app/(dashboard)/transaksi/page.tsx — Transactions hub (TanStack table / mobile cards + modals)
- apps/web/src/app/(dashboard)/belanja/page.tsx — Purchases procurement page
- apps/web/src/app/(dashboard)/inventori/page.tsx — Inventory stock management page
- apps/web/src/app/(dashboard)/hutang/page.tsx — Debts & receivables page
- apps/web/src/app/(dashboard)/laporan/page.tsx — Reports & CSV export page
- apps/web/src/app/(dashboard)/pengaturan/page.tsx — Settings & notification preferences page
- apps/web/src/__tests__/api-client.test.ts — Unit tests for API client error parsing

## Change Tracker
- **Files modified**: All 27 frontend source files in `apps/web/src/` and `packages/ui/src/components/badge.tsx`
- **Build status**: Pass (`next build` 12/12 static/dynamic routes compiled cleanly; `tsc --noEmit` 0 errors; `next lint` 0 errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pass (Turbo build, typecheck, test all pass with exit code 0)
- **Lint status**: 0 violations
- **Tests added/modified**: `apps/web/src/__tests__/api-client.test.ts` (3 tests verifying error envelope parsing)

## Loaded Skills
- **Source**: /Users/mac/.gemini/config/skills/frontend-design/SKILL.md
  - **Local copy**: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/skills/frontend-design.md
  - **Core methodology**: Intentional, distinctive visual design tailored to subject matter; avoid templated defaults and AI tells.
- **Source**: /Users/mac/.gemini/config/skills/antislop-ui/SKILL.md
  - **Local copy**: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/skills/antislop-ui.md
  - **Core methodology**: Eliminating generic AI-slop in UI: capped glass/glow/radii, meaningful icons, real states, honest empty/loading states.
- **Source**: /Users/mac/.gemini/config/skills/antislop-layoutmobile/SKILL.md
  - **Local copy**: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/skills/antislop-layoutmobile.md
  - **Core methodology**: Mobile layout reflows (not just shrinks); touch targets >= 44x44px; no horizontal overflow; bottom nav with proper padding.
