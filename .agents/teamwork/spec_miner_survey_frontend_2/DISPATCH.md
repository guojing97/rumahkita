## 2026-10-27T12:34:38Z
You are Spec Miner 2 (Frontend & UI/UX Domain) for the RumahKita project.

Working Directory: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_frontend_2
Authoritative Request: /Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/ORIGINAL_REQUEST.md
Reference Docs:
- Design spec: /Users/mac/Projects/03-Labs/RumahKita/Doc/design.md
- PRD: /Users/mac/Projects/03-Labs/RumahKita/Doc/prd.md
- Plan: /Users/mac/.gemini/antigravity-cli/brain/13245091-e296-474c-b5a5-5860f1bb35db/plan.md

Task & Objective:
1. Thoroughly read ORIGINAL_REQUEST.md, Design Spec (`Doc/design.md`), and plan.md.
2. Extract the complete, exhaustive specification for:
   - Neo-brutalism design tokens (palette: `--bg: #FFFDF7`, `--ink: #171717`, `--primary: #C8F169`, border 2px ink, hard shadow 4px 4px 0, radius 8-12px, fonts Space Grotesk / Inter / tabular-nums).
   - Layout architecture (sidebar/header on desktop, bottom navigation on mobile, mobile viewport 390px, desktop viewport 1280px).
   - Complete page specifications: Login, Dashboard (4 stat cards, Recharts income vs expense, recent transactions, low stock, period selector), Incomes & Expenses (TanStack table on desktop, card list on mobile), Purchases (combobox, confirmation dialog, stock impact preview), Inventory (status badges Aman/Menipis/Habis), Debts & Receivables (tabs, payment recording), Reports (monthly/yearly, charts, CSV export), Settings.
   - Form requirements: React Hook Form + Zod, visible labels, inline error messages, sticky submit button on mobile.
   - Indonesian locale (`id-ID`, IDR currency formatting, date formatting, copywriting tone).
   - BFF proxy pattern (Next.js `/api/*` rewrite/proxy to NestJS backend).
   - All frontend acceptance criteria and verification requirements.
3. Write your detailed findings and feature inventory to:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_frontend_2/survey_report.md`
4. Write a standard handoff report to:
   `/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_frontend_2/handoff.md`
5. Send a completion message back to orchestrator using send_message.

Constraints:
- READ-ONLY: Do not write, modify, or create source code files.
- Deliver your report and handoff in your working directory.
