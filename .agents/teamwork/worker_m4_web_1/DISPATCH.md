## 2026-10-27T18:09:36Z
You are worker_m4_web_1, assigned to implement and verify Milestone 4 (Frontend Web with Next.js App Router, Neo-brutalism UI, BFF Proxy, TanStack tables/cards, Recharts, and all 7 core pages) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1

Authoritative user request (MUST READ BEFORE STARTING):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index & Feature Inventory:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Explorer Specifications & Blueprints (MUST FOLLOW CLOSELY):
- Architecture & BFF Proxy: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_arch_1/arch_spec.md
- Neo-brutalism UI Tokens & Components: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2/design_spec.md
- 7 Core Pages & Forms: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_pages_3/pages_spec.md

Domain Skills:
- /Users/mac/.gemini/config/skills/frontend-design/SKILL.md
- /Users/mac/.gemini/config/skills/antislop-ui/SKILL.md
- /Users/mac/.gemini/config/skills/antislop-layoutmobile/SKILL.md

Write ownership:
- You own `apps/web/` exclusively (and `packages/ui/` for shared tokens/components if necessary).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Detailed Implementation Instructions:
1. Initialize your progress.md in your working directory and update it frequently with clear "Last visited: [timestamp]" timestamps.
2. Check `apps/web/package.json` and ensure required dependencies are installed (`@tanstack/react-table`, `recharts`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `clsx`, `tailwind-merge`, etc.). Run `pnpm install` if new packages are added.
3. Configure Neo-brutalism design tokens in `tailwind.config.ts` and `src/app/globals.css`:
   - Colors: `--bg: #FFFDF7` (Warm Cream), `--ink: #171717` (Deep Charcoal), `--primary: #C8F169` (Neon Lime), surfaces `#FFFFFF`.
   - Borders: 2px solid `#171717`.
   - Shadows: `box-shadow: 4px 4px 0px #171717` (unblurred hard shadow), button active press `translate-x-0.5 translate-y-0.5 shadow-none`.
   - Badges: `Aman ✓` (`#D1FAE5`/`#065F46`), `Menipis ⚠` (`#FEF3C7`/`#92400E`), `Habis ✕` (`#FEE2E2`/`#991B1B`).
   - Fonts: Space Grotesk / Inter with bold weights and high contrast (WCAG AA).
4. Implement the BFF Proxy Route Handler at `apps/web/src/app/api/[...path]/route.ts`:
   - Proxies requests to NestJS (`http://127.0.0.1:4000/api/v1`).
   - Forwards cookies (HttpOnly `refresh_token`), headers (`Authorization: Bearer <token>`, `X-Household-Id`, `Idempotency-Key`), and supports RFC 4180 streaming for CSV exports.
5. Implement UI Components (`packages/ui` or `apps/web/src/components/ui/`):
   - Button, Card, StatCard, Badge, Input, Select, Dialog/Drawer (desktop modal -> mobile bottom-sheet).
   - Responsive Navigation: 240px fixed left sidebar on Desktop (>=1024px), 56px sticky top bar + 64px fixed 5-item bottom nav on Mobile (<1024px, 390px base).
6. Implement all 7 Core Pages with responsive table-to-card reflow:
   - `/login`: Neo-brutalism login form, credentials validation via `loginSchema`, session cookie storage.
   - `/dashboard`: 4 stat cards (Pemasukan, Pengeluaran, Sisa Bersih, Stok Rendah), Recharts bar chart for monthly cash flow, recent transactions list, low stock warning widget.
   - `/transaksi`: Incomes & Expenses unified page, date & category filters, TanStack table on desktop, stacked card list on mobile (<768px), "Catat Pemasukan" and "Catat Pengeluaran" modals with React Hook Form + Zod contracts (`createIncomeSchema`, `createExpenseSchema`).
   - `/belanja`: Draft purchases list, draft editor with item selector combobox, dynamic items rows (quantity, unit price, subtotal calculation), "Selesaikan Pembelian" modal with stock increment preview and client UUID idempotency key.
   - `/inventori`: Items list with `Aman ✓`, `Menipis ⚠`, `Habis ✕` badges, Add Item modal (`createItemSchema`), Manual Stock Adjustment modal (`stockAdjustmentSchema`) with mandatory reason and client negative stock validation.
   - `/hutang`: Hutang & Piutang dual tabs, repayment progress bar, "Catat Pembayaran" modal (`recordPaymentSchema`) with balance validation.
   - `/laporan`: Monthly/Yearly cashflow views, 12-month zero continuity Recharts bar chart, category breakdown table, and 1-click Indonesian CSV download button.
   - `/pengaturan`: Household profile, members list, and notification channels preferences toggles.
7. Verification:
   - Run `pnpm --filter web typecheck` -> 0 errors.
   - Run `pnpm --filter web build` -> Next.js build succeeds cleanly with static & dynamic routes.
   - Run `pnpm --filter web lint` -> 0 errors/warnings.
   - Write comprehensive `handoff.md` in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/worker_m4_web_1/handoff.md`.
   - Send completion message to orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
