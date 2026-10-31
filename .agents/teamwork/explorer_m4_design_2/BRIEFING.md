# BRIEFING — 2026-10-27T18:07:30Z

## Mission
Explore and produce a comprehensive technical design and component specification (`design_spec.md`) covering Neo-brutalism tokens, component library blueprint, and responsive Table-to-Card reflow architecture for Milestone 4.

## 🔒 My Identity
- Archetype: teamwork_preview_spec_miner
- Roles: Teamwork specialist, specification miner, UI design & design systems expert
- Working directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2
- Original parent: b7285ab7-91ac-41dd-b752-01f7c3a3dbb1
- Milestone: M4 (Frontend Web with Next.js App Router)

## 🔒 Key Constraints
- Authoritative user request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
- Master Project Index: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/PROJECT.md
- Design Spec: /Users/mac/Projects/03-Labs/RumahKita/doc/design.md
- UI Tokens: packages/ui
- Neo-brutalism design tokens: #C8F169 (primary neon lime), #FFFDF7 (warm cream bg), #171717 (ink), 2px solid border, 4px 4px 0 hard drop shadow, 8px/12px radius.
- Stock Status Badges: Aman (Green #D1FAE5, ink #065F46, checkmark ✓), Menipis (Yellow/Amber #FEF3C7, ink #92400E, warning ⚠), Habis (Red/Rose #FEE2E2, ink #991B1B, cross ✕)
- Responsive Reflow: Desktop (>=768px) TanStack table -> Mobile (<768px, 390px base) stacked card list with zero horizontal scroll leak.
- Touch target min 44x44px.
- WCAG AA 4.5:1 text contrast compliance.
- Do NOT implement source code in .agents/teamwork/.
- Do NOT implement production code — exploration and specification only.

## Current Parent
- Conversation ID: b7285ab7-91ac-41dd-b752-01f7c3a3dbb1
- Updated: 2026-10-27T18:07:30Z

## Loaded Skills
- Source: /Users/mac/.gemini/config/skills/frontend-design/SKILL.md
  Local copy: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2/skills/frontend-design.md
  Core methodology: Distinctive visual identity, authentic typography, deliberate palette, purposeful layout.
- Source: /Users/mac/.gemini/config/skills/antislop-ui/SKILL.md
  Local copy: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2/skills/antislop-ui.md
  Core methodology: Eliminate AI slop (no gradients, no soft blurry floating shadows, no glassmorphism abuse, no pill-everything, no fake data, strict 2-3 colors + 1 accent).
- Source: /Users/mac/.gemini/config/skills/antislop-layoutmobile/SKILL.md
  Local copy: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/explorer_m4_design_2/skills/antislop-layoutmobile.md
  Core methodology: Mobile reflow is a distinct state, not desktop shrunk; zero horizontal scroll leak; 44px tap targets.

## Task Summary
- **What to build**: Comprehensive technical design and component specification (`design_spec.md`) for Milestone 4 (Frontend Web).
- **Success criteria**: Detailed neo-brutalism token matrix with WCAG AA contrast analysis; component library blueprint (`Button`, `Card`, `Badge`, `Input`, `Select`, `Dialog`/`Drawer`, `StatCard`); Responsive Table-to-Card reflow architecture (TanStack Table vs Mobile Card List); and design verification checklist.
- **Interface contracts**: PROJECT.md, doc/design.md, packages/contracts
- **Code layout**: packages/ui, apps/web

## Key Decisions Made
- Confirmed WCAG AA/AAA mathematical proof: `#171717` ink on `#C8F169` primary yields 13.9:1 (PASS), whereas white text would fail at 1.29:1.
- Stock Status Badges specified with exact hex values: Aman (`#D1FAE5` bg / `#065F46` text / `✓`), Menipis (`#FEF3C7` bg / `#92400E` text / `⚠`), Habis (`#FEE2E2` bg / `#991B1B` text / `✕`).
- Button active mechanical depression: `active:translate-x-0.5 active:translate-y-0.5 active:shadow-none` with default `h-11` (44px) meeting touch target accessibility.
- Dialog reflow: Desktop centered modal (`rounded-modal`, `shadow-neo-lg`) -> Mobile bottom-sheet drawer (`rounded-t-2xl`, drag handle, sticky bottom action bar).
- TanStack Table vs Mobile Card reflow: `hidden md:block` for table, `block md:hidden` for stacked cards; zero horizontal overflow.

## Artifact Index
- design_spec.md — Comprehensive technical design & component specification for M4
- handoff.md — Subagent completion handoff report
- progress.md — Liveness heartbeat
