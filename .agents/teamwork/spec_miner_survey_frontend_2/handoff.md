# Handoff Report — Spec Miner Survey (Frontend & UI/UX Domain)

**Agent ID:** spec_miner_survey_frontend_2  
**Target:** Orchestrator (`c4aff318-95ce-46a6-8cfa-3b57f0b6f8fb`)  
**Timestamp:** 2026-10-27T12:40:00Z  
**Type:** Hard Handoff (Task Complete)

---

## 1. Observation

Directly probed and extracted from authoritative project documentation:
- **`ORIGINAL_REQUEST.md` (lines 40–50, 90–95):**
  - Next.js App Router, Turborepo + pnpm workspace (`apps/web`, `packages/ui`).
  - Neo-brutalism tokens: `--bg: #FFFDF7`, `--ink: #171717`, `--primary: #C8F169`, hard shadow `4px 4px 0`, `2px` ink borders, `8-12px` radius.
  - Space Grotesk headings, Inter body, `tabular-nums` for financial numbers, `Intl.NumberFormat('id-ID', ...)` for IDR.
  - Responsive acceptance criteria: Add expense flow must complete on 390px (mobile) and 1280px (desktop); expense list renders as table on desktop and card list on mobile; form inputs require visible permanent labels and inline error messages.
- **`Doc/design.md` (lines 1–360):**
  - Section 2 (Visual Tokens): Complete color palette table (`--bg`, `--surface`, `--ink`, `--muted`, `--primary`, `--secondary`, `--accent`, `--lavender`, `--success`, `--warning`, `--danger`, `--border`), typography specifications, elevation physics (`box-shadow: 4px 4px 0 var(--ink)`, hover `translate(-1px, -1px)`, active `translate(2px, 2px)`), no blur, no glassmorphism.
  - Section 3 (Layout & Navigation): Desktop sidebar 240–260px, top bar, 12-column grid; Mobile compact header, 5-item bottom navigation (Dashboard, Transaksi, Barang, Laporan, Lainnya drawer).
  - Section 4 (Page Specifications): Login (no public signup), Dashboard (4 stat cards, Recharts monthly bar chart, recent transactions, low stock, due soon debts, empty state), Incomes, Expenses (with purchase link), Purchases (combobox, dynamic rows, sticky total, confirmation dialog with stock impact preview), Inventory (badges: Aman ✓, Menipis ⚠, Habis ✕, stock movement history, manual correction dialog with mandatory reason), Debts & Receivables (Hutang/Piutang tabs, payment recording dialog with balance validation), Reports (monthly/yearly, charts, CSV export), Settings (profiles, household invitation, master data, notification config with test button).
  - Section 5 & 6: Component primitives, interaction timings (120–180ms), `prefers-reduced-motion` compliance.
  - Section 8: Indonesian household copywriting standards.
- **`Doc/prd.md` (lines 114–273, 483–495):**
  - Functional flows, atomic purchase completion, non-negative stock enforcement, debt payment balance limits, BFF proxy architecture using Next.js App Router rewrite/proxy to NestJS backend, and cookie-based authentication (`HttpOnly`, `Secure`, `SameSite=Lax`).
- **`plan.md` (lines 164–191, 226–244, 273–288, 303–322):**
  - Implementation phases 0D, 1D, 2C, 3B, 4B defining frontend module structure in `apps/web` and `packages/ui`.

---

## 2. Logic Chain

1. **Requirement Alignment:** The original user request specifies a private household finance app with Neo-brutalism styling and mobile-first responsiveness.
2. **Design System Constraints:** `Doc/design.md` provides unambiguous specifications for CSS variables, typography, shadows, and radii. The prohibition of blurred shadows and generic gradients means standard Tailwind defaults or generic AI slop MUST be overridden via explicit design tokens and Radix/shadcn customizations.
3. **Responsive Architecture:** Desktop requires a fixed 240px sidebar and multi-column TanStack data grids. Mobile (390px target) cannot use horizontal scrolling data tables; it requires a dual-view system where tables automatically convert to card lists, forms feature sticky bottom submit bars, and secondary modules reside in a "Lainnya" bottom drawer.
4. **Task-Oriented Purchase Flow:** Purchases link directly to inventory stock and financial expenses. Therefore, the UI requires an atomic confirmation modal displaying a preview of inventory impact (e.g. `1 -> 3 liter`) before the backend transaction completes.
5. **Localization & Safety:** Indonesian locale (`id-ID`, `Asia/Jakarta`, IDR integer currency) and conversational copywriting ensure the two household members can record transactions quickly (<30 seconds) without accounting jargon or validation confusion.
6. **BFF Pattern:** Using Next.js App Router as a BFF proxy simplifies cookie transmission, prevents leaking API endpoints, and handles automatic token refreshing without storing tokens in `localStorage`.

---

## 3. Caveats

- **Mockup/Design Assets:** No external Figma URL was supplied; all visual rules are strictly derived from the text-based design system in `Doc/design.md`.
- **Chart Library Responsiveness:** Recharts requires explicit `<ResponsiveContainer width="100%" height={...} />` wrappers to prevent SVG overflow on 360px/390px viewports.
- **Master Data Location:** Design spec notes that `Sumber Pendapatan` and `Kategori` management can either be standalone in `/settings` or accessible via in-place master data management on the transaction pages. The specification recommends providing both (full management in Settings, quick-add in transaction dropdowns).

---

## 4. Conclusion

The frontend specification survey is complete and comprehensive. All design tokens, layout architectures, page specifications, component contracts, form rules, Indonesian localization standards, BFF proxy mechanics, acceptance criteria, and 15 specific edge cases have been extracted and documented in:
`/Users/mac/Projects/03-Labs/RumahKita/.agents/teamwork/spec_miner_survey_frontend_2/survey_report.md`

The frontend implementation team can proceed directly to building `packages/ui` and `apps/web` with zero ambiguity regarding layout, tokens, components, or edge case handling.

---

## 5. Verification Method

To independently verify the extracted specifications against authoritative files:
1. **Design Tokens & Colors:** Check `Doc/design.md` §2 lines 32–46 against `survey_report.md` §2.1.
2. **Typography & Shadows:** Check `Doc/design.md` §2 lines 51–74 against `survey_report.md` §2.2 & §2.3.
3. **Responsive Layout:** Check `Doc/design.md` §3 lines 80–107 against `survey_report.md` §3.
4. **Purchase Flow & Confirmation:** Check `Doc/design.md` §4.5 lines 161–177 against `survey_report.md` §4.5 and Feature #22 in Table 10.
5. **Acceptance Criteria:** Check `ORIGINAL_REQUEST.md` lines 90–95 against `survey_report.md` §9.
