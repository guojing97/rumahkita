# Adversarial Challenge & Verification Report: Milestone 4 Frontend Web

**Verdict**: **APPROVE**  
**Agent**: `challenger_m4_1` (Critic & Specialist: Responsive UI, Mobile Ergonomics & Neo-brutalism Design System)  
**Target Milestone**: Milestone 4 (Frontend Web with Next.js App Router)  
**Date**: 2026-10-27T18:59:30Z  

---

## 1. Observation

### 1.1 Responsive Layout & Mobile Ergonomics (390px Viewport — iPhone 12/13/14 Base)
- **56px Sticky Top Bar**:
  - Code reference: `apps/web/src/components/layout/mobile-top-bar.tsx:13`
    ```tsx
    <header className="h-14 sticky top-0 bg-surface border-b-neo border-ink z-30 flex items-center justify-between px-4 lg:hidden select-none">
    ```
  - Empirical measurement via Playwright at 390x844px:
    - Bounding box width: `390px`, height: `56px` (`h-14` = 3.5rem = 56px).
    - Computed CSS `position: "sticky"`, `top: "0px"`.
    - Hidden on desktop (`lg:hidden`, `display: none` at >=1024px).
- **64px Fixed 5-Item Bottom Nav**:
  - Code reference: `apps/web/src/components/layout/mobile-bottom-nav.tsx:34-80`
    ```tsx
    <nav className="h-16 fixed bottom-0 left-0 right-0 bg-surface border-t-neo border-ink z-40 flex items-center justify-around px-1 lg:hidden select-none">
    ```
  - Empirical measurement via Playwright at 390x844px:
    - Bounding box width: `390px`, height: `64px` (`h-16` = 4rem = 64px).
    - Computed CSS `position: "fixed"`, `bottom: "0px"`.
    - Contains exactly 5 items: `Dashboard` (A), `Transaksi` (A), `Belanja` (A), `Inventori` (A), `Lainnya` (BUTTON triggering `MoreMenuDrawer`).
    - Every individual nav item measures `76px × 62px` (strictly exceeding the WCAG/Apple HIG minimum `44px × 44px` touch target).
- **Content Reservation (`pb-24`)**:
  - Code reference: `apps/web/src/app/(dashboard)/layout.tsx:46`
    ```tsx
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12">
    ```
  - Empirical measurement via Playwright:
    - Main container computed `padding-bottom: "96px"` (`pb-24` = 6rem = 96px).
    - With a 64px bottom nav, this guarantees a generous `32px` clearance buffer above the bottom navigation bar, preventing any floating buttons, action bars, or list items from being obscured.
- **Zero Horizontal Scrolling**:
  - Verified empirically via Playwright `document.documentElement.scrollWidth <= window.innerWidth`:
    - `/login`: `scrollWidth: 390px`, `innerWidth: 390px` (`hasHorizontalOverflow: false`).
    - `/dashboard`: `scrollWidth: 390px`, `innerWidth: 390px` (`hasHorizontalOverflow: false`).
    - `/transaksi`: `scrollWidth: 390px`, `innerWidth: 390px` (`hasHorizontalOverflow: false`).
    - `/inventori`: `scrollWidth: 390px`, `innerWidth: 390px` (`hasHorizontalOverflow: false`).
    - `/hutang`: `scrollWidth: 390px`, `innerWidth: 390px` (`hasHorizontalOverflow: false`).

### 1.2 Desktop Layout (1280px+ Viewport)
- **240px Fixed Left Sidebar**:
  - Code reference: `apps/web/src/components/layout/desktop-sidebar.tsx:33`
    ```tsx
    <aside className="w-60 h-screen fixed left-0 top-0 bg-surface border-r-neo border-ink flex-col p-4 z-40 hidden lg:flex select-none">
    ```
  - Code reference: `apps/web/src/app/(dashboard)/layout.tsx:44`
    ```tsx
    <main className="flex-1 lg:pl-60">
    ```
  - Empirical measurement via Playwright at 1280x900px:
    - Sidebar bounding box width: `240px` (`w-60` = 15rem = 240px), height: `900px`.
    - Computed CSS `position: "fixed"`, `left: "0px"`, `display: "flex"`.
    - Main content computed `padding-left: "240px"` (`lg:pl-60`), properly offsetting page content.
    - Mobile header and bottom nav cleanly evaluate to `display: "none"`.
- **Desktop Modal Centering**:
  - Code reference: `apps/web/src/components/ui/dialog.tsx:68-87`
    ```tsx
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center">
      <div className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity duration-200" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal="true" className={cn(..., 'md:rounded-modal md:border-neo-thick md:p-6 md:max-h-[85vh] md:pb-6', maxWidthClass)}>
    ```
  - Empirical measurement when triggering "+ Pengeluaran" dialog at 1280x900px:
    - Viewport center: `(x: 640px, y: 450px)`.
    - Dialog bounding box: `x: 384px, y: 157px, width: 512px, height: 586px`.
    - Calculated dialog center: `(384 + 256, 157 + 293) = (x: 640px, y: 450px)`.
    - Result: **Mathematically and pixel-perfect centered** in viewport.
    - Backdrop: Computed `fixed inset-0` with `bg-ink/60` active.
    - Keyboard dismissal: Verified pressing `Escape` closes the modal cleanly.

### 1.3 Table-to-Card Reflow
- **/transaksi**:
  - Desktop container `hidden md:block`: Evaluates to `display: none` at 390px, `display: block` at 1280px. TanStack table renders 6 columns (`Tanggal`, `Tipe`, `Kategori / Sumber`, `Catatan`, `Nominal`, `Aksi`) with 21 transaction rows.
  - Mobile container `md:hidden space-y-3`: Evaluates to `display: block` at 390px, `display: none` at 1280px. Renders 21 stacked cards measuring `358px` width (leaving 16px margins on 390px viewport) with badge, date, category/source, notes, payment method, formatted nominal, and trash action button (`min-h-[44px] min-w-[44px]`).
- **/inventori**:
  - Desktop container `hidden md:block`: Evaluates to `display: none` at 390px, `display: block` at 1280px with 6 columns.
  - Mobile container `md:hidden space-y-3`: Evaluates to `display: block` at 390px, `display: none` at 1280px with 25 stacked cards (each `358px` wide) displaying item name, stock count, minimum threshold, category, location, and action buttons.
- **/hutang**:
  - Desktop container `hidden md:block`: Evaluates to `display: none` at 390px, `display: block` at 1280px with 7 columns.
  - Mobile container `md:hidden space-y-3`: Evaluates to `display: block` at 390px, `display: none` at 1280px with 11 stacked cards displaying party name, description, status badge, outstanding balance (`tabular-nums`), visual payment progress bar with percentage, due date, and "Catat Pembayaran" button.

### 1.4 Neo-Brutalism Design Tokens & Contrast Ratios
- **Contrast Ratios**:
  - Foreground `#171717` (Deep Charcoal ink) on `#C8F169` (Neon Lime primary):
    $$\text{Contrast Ratio} = \frac{0.7813 + 0.05}{0.0098 + 0.05} = 13.87:1$$
    **Passes WCAG AAA** (threshold $\ge 7.0:1$).
  - White text `#FFFFFF` on `#C8F169` (Neon Lime):
    $$\text{Contrast Ratio} = \frac{1.0 + 0.05}{0.7813 + 0.05} = 1.29:1 \quad (\text{Severe Fail})$$
    - Static analysis across `apps/web/src` and `packages/ui/src` confirms **0 occurrences** of `text-white` on `bg-primary`. All primary components use `text-ink` on `bg-primary`.
- **Status Badges**:
  - `Aman ✓`: `#065F46` on `#D1FAE5` $\rightarrow \mathbf{6.78:1}$ (Passes WCAG AA $\ge 4.5:1$). Icon: `<Check className="w-3.5 h-3.5" />`.
  - `Menipis ⚠`: `#92400E` on `#FEF3C7` $\rightarrow \mathbf{6.37:1}$ (Passes WCAG AA $\ge 4.5:1$). Icon: `<AlertTriangle className="w-3.5 h-3.5" />`.
  - `Habis ✕`: `#991B1B` on `#FEE2E2` $\rightarrow \mathbf{6.80:1}$ (Passes WCAG AA $\ge 4.5:1$). Icon: `<XCircle className="w-3.5 h-3.5" />`.
  - `Overdue ⚠`: `#991B1B` on `#FEE2E2` $\rightarrow \mathbf{6.80:1}$. Icon: `<Clock className="w-3.5 h-3.5" />`.
- **Elevation & Shadows**:
  - Hard drop shadows: 0px blur, 4px displacement (`shadow-neo: 4px 4px 0 var(--ink)`). Evaluated computed style on cards/buttons: `rgb(23, 23, 23) 4px 4px 0px 0px`.
  - Large modal dialog shadow: `6px 6px 0 var(--ink)`. Evaluated computed style: `rgb(23, 23, 23) 6px 6px 0px 0px`.
  - Button interaction: Hover translations (`hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-neo-hover`), and active depression (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-neo-active`).

### 1.5 Automated Build & Test Execution
- `pnpm --filter @rumahkita/web typecheck` $\rightarrow$ Exited 0 (0 TypeScript errors).
- `pnpm --filter @rumahkita/web lint` $\rightarrow$ Exited 0 ("✔ No ESLint warnings or errors").
- `pnpm --filter @rumahkita/web test` $\rightarrow$ Exited 0 (15/15 unit and adversarial integration tests passed across 6 test suites in 462ms).
- `pnpm --filter @rumahkita/web build` $\rightarrow$ Exited 0 (Next.js 14.2.35 production build cleanly compiled all 12 static/dynamic routes: `/`, `/_not-found`, `/api/[...path]`, `/belanja`, `/dashboard`, `/hutang`, `/inventori`, `/laporan`, `/login`, `/pengaturan`, `/transaksi`, `middleware`).
- `pnpm turbo run build typecheck test lint` $\rightarrow$ Exited 0 ("18 successful, 18 total, FULL TURBO").

---

## 2. Logic Chain

1. **Premise 1 (Design Spec §3 & §7 Alignment)**: Mobile layouts must prevent horizontal scrolling on 360–390px screens and reserve vertical padding for fixed navigation bars.
   - *Evidence from §1.1*: At 390px viewport, `document.documentElement.scrollWidth` strictly equals `390px` on all routes (`hasHorizontalOverflow: false`). The main container reserves `pb-24` (96px), ensuring content is never obscured by the 64px fixed bottom navigation bar.
2. **Premise 2 (Touch Accessibility & Ergonomics)**: All interactive touch targets on mobile must meet the minimum 44×44px standard.
   - *Evidence from §1.1*: Playwright bounding box measurements confirm every bottom nav item (`76px × 62px`), header links (`min-h-[44px] min-w-[44px]`), and mobile card action buttons exceed the 44px threshold.
3. **Premise 3 (Responsive Data Reflow)**: Wide financial data tables must reflow into legible, touch-friendly stacked cards on screens <768px without data loss.
   - *Evidence from §1.3*: On `/transaksi`, `/inventori`, and `/hutang`, the desktop `table` evaluates to `display: none` at 390px, while stacked Neo-brutalism cards render at 358px width with all essential metadata (formatted nominals in `tabular-nums`, progress bars, status badges, action triggers). At 1280px, the card lists hide and full TanStack tables display with sorting and filtering.
4. **Premise 4 (Neo-Brutalism Token Compliance)**: Colors, typography, borders, and shadows must adhere to `design.md §2`. High contrast must be maintained to prevent illegibility.
   - *Evidence from §1.4*: `#171717` on `#C8F169` achieves a 13.87:1 AAA contrast ratio; white text on lime is completely absent. All status badges include explicit text + icons with $>6.3:1$ contrast. Drop shadows are unblurred hard ink projections (`4px 4px 0 #171717`).
5. **Deduction**: Because all responsive layout rules, Neo-brutalism tokens, table-to-card reflow behaviors, typechecks, production builds, and automated test suites pass without regression or flaw, Milestone 4 is fully verified and ready for deployment.

---

## 3. Caveats

- **Concurrent Next.js Builds**: Running two simultaneous instances of `next build` in `apps/web/` causes file contention race conditions on `.next/build-manifest.json` and `.next/export/500.html`. Each build command must run sequentially.
- **Node Test Runner Module Resolution**: The monorepo uses Node's native test runner (`node --experimental-strip-types`). When importing local TypeScript files in test suites outside of Webpack, explicit file extensions (`.ts`) or custom loader hooks are required by Node ESM.
- **End-to-End Live Data**: Live end-to-end communication via the BFF proxy `/api/[...path]` requires the NestJS backend (`apps/api` on port 4000) and PostgreSQL/Redis services to be running.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 4 (Frontend Web with Next.js App Router) demonstrates exemplary technical execution, rigorous responsiveness, and faithful adherence to the Neo-brutalism design specification. The dual-rendering architecture cleanly adapts between mobile and desktop viewports, touch targets exceed accessibility guidelines, contrast ratios satisfy WCAG AAA/AA, and all automated builds, lints, typechecks, and tests across the monorepo pass cleanly.

---

## 5. Verification Method

To independently reproduce and verify this assessment:

1. **Typecheck Web App**:
   ```bash
   pnpm --filter @rumahkita/web typecheck
   ```
   *Expected result*: Exits 0 with 0 errors.

2. **Lint Web App**:
   ```bash
   pnpm --filter @rumahkita/web lint
   ```
   *Expected result*: Exits 0 with "✔ No ESLint warnings or errors".

3. **Run Unit & Integration Tests**:
   ```bash
   pnpm --filter @rumahkita/web test
   ```
   *Expected result*: Exits 0 with 15/15 tests passing across 6 suites.

4. **Compile Production Build**:
   ```bash
   pnpm --filter @rumahkita/web build
   ```
   *Expected result*: Exits 0, compiling all 12 static/dynamic routes.

5. **Verify Monorepo Integrity**:
   ```bash
   pnpm turbo run build typecheck test lint
   ```
   *Expected result*: Exits 0 with 18/18 tasks successful ("FULL TURBO").

6. **Verify Contrast Calculation**:
   ```bash
   node -e '
   function sRGBtoLin(c){const v=c/255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
   function lum(r,g,b){return 0.2126*sRGBtoLin(r)+0.7152*sRGBtoLin(g)+0.0722*sRGBtoLin(b);}
   function cr(h1,h2){const p=h=>{const n=parseInt(h.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];};const l1=lum(...p(h1)),l2=lum(...p(h2));return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2);}
   console.log("Ink on Lime:", cr("#171717","#C8F169")+":1");
   '
   ```
   *Expected result*: Output is `13.87:1` (AAA).
