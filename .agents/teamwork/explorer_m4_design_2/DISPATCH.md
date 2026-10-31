# Dispatch: Explorer M4 Design 2 — Neo-brutalism UI Tokens, Components, & Reflow

Target Agent: explorer_m4_design_2
Role: teamwork_preview_spec_miner
Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2
Authoritative User Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Master Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
Design Spec: /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
Design Tokens Package: /Users/mac/Projects/03-Labs/RumahKita/packages/ui
Design Skills:
- /Users/mac/.gemini/config/skills/frontend-design/SKILL.md
- /Users/mac/.gemini/config/skills/antislop-ui/SKILL.md
- /Users/mac/.gemini/config/skills/antislop-layoutmobile/SKILL.md

Scope:
Investigate and design:
1. Neo-brutalism design tokens integration:
   - Primary: `#C8F169` (Neon Lime)
   - Background: `#FFFDF7` (Warm Cream / Off-white)
   - Ink: `#171717` (Deep Charcoal Black)
   - Borders: 2px solid `#171717`
   - Shadows: 4px 4px 0px `#171717` (unblurred hard drop shadow)
   - Radii: 8px (small), 12px (cards/modals)
   - Stock Status Badges:
     - `Aman` (Green `#D1FAE5`, ink `#065F46`, checkmark `✓`)
     - `Menipis` (Yellow/Amber `#FEF3C7`, ink `#92400E`, warning `⚠`)
     - `Habis` (Red/Rose `#FEE2E2`, ink `#991B1B`, cross `✕`)
2. Component Library & TanStack Reflow Architecture:
   - Table on Desktop (TanStack React Table with sortable headers, pagination, actions).
   - Card List on Mobile (<768px): clean stacked cards displaying key transaction metrics without horizontal scroll.
   - Form inputs, Modals/Drawers with neo-brutalism styling and mobile bottom-sheet behavior.

## 2026-10-27T18:00:38Z
You are explorer_m4_design_2 for Milestone 4 (Frontend Web with Next.js App Router) for the RumahKita household finance & inventory application MVP.

Your working directory is:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2

Authoritative user request (MUST READ FIRST):
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md

Master Project Index:
/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md

Design Spec:
- /Users/mac/Projects/03-Labs/RumahKita/doc/design.md

Design Skills & Tools:
- /Users/mac/.gemini/config/skills/frontend-design/SKILL.md
- /Users/mac/.gemini/config/skills/antislop-ui/SKILL.md
- /Users/mac/.gemini/config/skills/antislop-layoutmobile/SKILL.md

UI Tokens Package:
- /Users/mac/Projects/03-Labs/RumahKita/packages/ui

Mission:
Explore and produce a comprehensive technical design and component specification (`design_spec.md`) covering:
1. Neo-brutalism Design System Tokens:
   - Primary: `#C8F169` (Neon Lime)
   - Background: `#FFFDF7` (Warm Cream / Off-white)
   - Surface / Card: `#FFFFFF` with 2px solid `#171717` border and 4px 4px 0px `#171717` hard drop shadow
   - Ink: `#171717` (Deep Charcoal Black)
   - Radius: 8px (small elements / buttons), 12px (cards, dialogs, drawers)
   - Contrast check: ensure WCAG AA compliance (4.5:1 text contrast).
   - Stock Status Badges:
     - `Aman` (Green `#D1FAE5`, ink `#065F46`, checkmark `✓`)
     - `Menipis` (Yellow/Amber `#FEF3C7`, ink `#92400E`, warning `⚠`)
     - `Habis` (Red/Rose `#FEE2E2`, ink `#991B1B`, cross `✕`)
2. Component Library Blueprint:
   - `Button`: neo-brutalism variants (`primary`, `secondary`, `destructive`, `ghost`), active click translation (`translate-x-0.5 translate-y-0.5 shadow-none`).
   - `Card`, `Badge`, `Input`, `Select`, `Dialog` / `Drawer` (mobile bottom-sheet).
   - `StatCard`: icon, title, big bold formatted nominal (`formatIDR`), change indicator.
3. Responsive Table-to-Card Reflow (TanStack Table vs Mobile Card List):
   - Desktop (>=768px): TanStack table with column headers, formatted numbers, sort indicators, action buttons.
   - Mobile (<768px, 390px base): Card list rendering identical data in high-density stacked cards with zero horizontal overflow, thumb-friendly tap targets (min 44px).
4. Output your detailed specification in `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2/design_spec.md` and send a completion message to orchestrator (`b7285ab7-91ac-41dd-b752-01f7c3a3dbb1`).
