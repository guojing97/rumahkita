# Comprehensive Frontend & UI/UX Specification Survey Report
**Project:** RumahKita — Household Finance & Inventory Web Application (MVP)  
**Investigator:** Spec Miner 2 (Frontend & UI/UX Domain)  
**Date:** 2026-10-27  
**Authoritative Sources:**
- `Doc/design.md` (Design System & UI Specification)
- `Doc/prd.md` (Product Requirements Document)
- `plan.md` (Turborepo Monorepo Implementation Plan)
- `ORIGINAL_REQUEST.md` (User Requirements & Acceptance Criteria)

---

## 1. Executive Summary

RumahKita is a private household finance and inventory management web application designed specifically for two household partners (husband and wife) to manage shared finances and household supplies collaboratively. The visual language is **Neo-brutalism**, characterized by thick black outlines, crisp unblurred hard drop shadows, high-contrast energetic accent colors, structured paneling, and distinctive typography, paired with strict accessibility (WCAG AA), friendly Indonesian household copywriting, and mobile-first responsiveness.

This survey provides an exhaustive technical and design specification for the entire frontend application (`apps/web` and `packages/ui`), covering design tokens, layout hierarchy, page specifications, component contracts, form validation behaviors, Indonesian localization rules, BFF proxy patterns, acceptance criteria, and edge cases.

---

## 2. Neo-Brutalism Design Token System

The frontend visual design is governed by strict CSS variable tokens. Hardcoded random hex values, blurred shadows, generic gradient backgrounds, and excessive glassmorphism are explicitly prohibited.

### 2.1 Color Palette Tokens

| Token Variable | Hex Code | Semantic Role & UI Usage | Accessibility & Contrast Rules |
|---|---|---|---|
| `--bg` | `#FFFDF7` | Primary canvas / page background (warm cream) | Base surface for cards, navigation, and layout shells |
| `--surface` | `#FFFFFF` | Form surfaces, cards, modal dialogs, drawers | High contrast against `--ink` borders |
| `--ink` | `#171717` | Primary text, borders, hard drop shadows | WCAG AAA contrast (>14:1) against `--bg` and `--surface` |
| `--muted` | `#66645F` | Secondary labels, hints, timestamps, metadata | WCAG AA compliant (>4.5:1) for body text |
| `--primary` | `#C8F169` | Main CTA buttons (`Masuk`, `+ Tambah`, `Selesaikan`), key highlights | Vibrant lime/yellow-green; paired with `--ink` text for maximum contrast |
| `--secondary` | `#B9D9FF` | Informational cards, focus rings, secondary panels | Soft sky blue; paired with `--ink` text |
| `--accent` | `#FF8A65` | Purchase workflows, special action highlights | Warm coral/peach; paired with `--ink` text |
| `--lavender` | `#D9C8FF` | Chart elements, secondary visual accents | Soft purple; used in charts and tags |
| `--success` | `#287D4F` | Status "Aman", positive net cash flow, success toasts | Deep green; MUST be paired with text and checkmark icon (✓) |
| `--warning` | `#9A5700` | Status "Menipis", alert badges, warning toasts | Amber brown/ochre; MUST be paired with text and alert icon (⚠) |
| `--danger` | `#B42318` | Status "Habis", overdue debts, destructive actions | Crimson red; MUST be paired with text and cross icon (✕) |
| `--border` | `#171717` | Structural container outlines (2px default, 3px hero) | Strict 2px solid `--ink` outline on all cards, inputs, and buttons |

*Critical Accessibility Constraint:* Status indication MUST NEVER rely solely on color. Status badges, alerts, and feedback banners must always display descriptive Indonesian text accompanied by an SVG icon.

### 2.2 Typography Scale & Rules

| Role | Font Family | Weights | Usage & Constraints |
|---|---|---|---|
| **Display & Headings** | `Space Grotesk` (fallback: `Archivo`, sans-serif) | SemiBold (600), Bold (700) | Page titles (H1), modal headings (H2), section headers (H3). No full-caps for long titles. |
| **Body & UI Controls** | `Inter` (fallback: `Geist Sans`, sans-serif) | Regular (400), Medium (500), SemiBold (600) | Form labels, table cells, helper text, button labels, badge text. |
| **Financial Figures** | Font with `tabular-nums` | Medium (500), Bold (700) | `font-variant-numeric: tabular-nums` enabled on all IDR values, quantities, and balances to align digits vertically. |

- **Line Length:** Kept under 80 characters for readability.
- **Copywriting Style:** Sentence case for headings and buttons; no uppercase tracking gimmicks.

### 2.3 Geometry, Borders, Shadows & Elevation Physics

- **Border Width:**
  - Standard elements: `2px solid var(--ink)` (cards, tables, form fields, badges, standard buttons).
  - Hero elements / Key CTAs: `3px solid var(--ink)`.
- **Corner Radii:**
  - Cards, panels, modal dialogs, drawers: `8px` to `12px` (default `10px`).
  - Form inputs, selects, textareas: `8px` to `10px`.
  - Buttons: `8px`.
  - Status Badges / Chips: `6px`.
  - *Prohibition:* No global pill-shaped borders (`rounded-full`) for standard UI cards or inputs.
- **Hard Shadows (Elevation System):**
  - Standard cards, buttons, dropdowns: `box-shadow: 4px 4px 0 var(--ink)`.
  - Large modal dialogs, drawer panels: `box-shadow: 6px 6px 0 var(--ink)`.
  - *Prohibition:* Zero blur radius (`blur: 0px`). No Gaussian blurs, no frosted glass (`backdrop-filter: blur`), no diffuse drop shadows.
- **Micro-Interaction Physics:**
  - Standard Hover: `transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--ink);`
  - Active / Pressed: `transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink);`
  - Animation Duration: `120ms` to `180ms` ease-out.
  - Accessibility: `prefers-reduced-motion` strictly honored (disables translation shifts).

### 2.4 Spacing System

Strict scale based on 4px grid: `4px` (0.25rem), `8px` (0.5rem), `12px` (0.75rem), `16px` (1rem), `24px` (1.5rem), `32px` (2rem), `40px` (2.5rem), `48px` (3rem).

---

## 3. Layout Architecture & Responsive Breakpoints

RumahKita is architected with a mobile-first responsive paradigm, ensuring seamless usability on mobile smartphones (360px–390px) as well as desktop monitors (1280px+).

```
+---------------------------------------------------------------------------------------+
| Desktop Layout (>= 1024px, target 1280px)                                             |
+-------------------+-------------------------------------------------------------------+
| SIDEBAR (240px)   | TOP BAR (Title, Period Selector, + Tambah CTA, User Avatar/Menu)   |
| - Logo / Wordmark +-------------------------------------------------------------------+
| - Household Switch| MAIN CONTENT (12-column grid, max-w-7xl, comfortable margins)     |
| - Nav Links (1-7) |                                                                   |
| - Low Stock Alert | - Stat Cards Grid (4 columns)                                     |
|   Summary         | - Main Visualization / Recharts Bar Chart                         |
| - User Profile    | - Dual Split Panels (Recent Transactions & Items to Buy)          |
|   & Logout        | - TanStack Data Tables                                            |
+-------------------+-------------------------------------------------------------------+

+-------------------------------------------------------+
| Mobile Layout (360px - 768px, target 390px viewport)   |
+-------------------------------------------------------+
| COMPACT HEADER (Logo, Current Page Name, User Avatar) |
+-------------------------------------------------------+
| MAIN CONTENT (Single column, max-w-full, px-4, pb-24) |
| - Summary Cards (stacked or 2-col compact grid)       |
| - Card Lists (replacing wide data tables)             |
| - Single column form with sticky bottom action bar    |
+-------------------------------------------------------+
| BOTTOM NAVIGATION BAR (Fixed at bottom, 4 items + Lain)
| [Dashboard]  [Transaksi]  [Barang]  [Laporan]  [Lainnya]
+-------------------------------------------------------+
```

### 3.1 Breakpoint Standards

- Mobile Small: `360px`
- Mobile Standard (Primary target): `390px` (iOS iPhone 12/13/14/15 standard width)
- Tablet / Foldable: `768px` (md)
- Desktop Small: `1024px` (lg)
- Desktop Standard (Primary target): `1280px` (xl)

### 3.2 Desktop Shell Specification

- **Sidebar:** Fixed width `240px` to `260px`, border-right `2px solid var(--ink)`, background `--bg` or `--surface`.
  - Brand header: Wordmark "RumahKita" with bold neo-brutalist styling.
  - Household selector / badge: Displays active household name ("Keluarga Kami").
  - Navigation menu list:
    1. Dashboard (`/dashboard`)
    2. Transaksi (`/transactions` or collapsible submenu: Pemasukan `/incomes`, Pengeluaran `/expenses`)
    3. Pembelian (`/purchases`)
    4. Barang / Inventori (`/inventory`)
    5. Hutang & Piutang (`/debts-receivables`)
    6. Laporan (`/reports`)
    7. Pengaturan (`/settings`)
  - Low stock warning banner in sidebar footer if items are low.
  - Active navigation state: Background `--primary`, border `2px solid var(--ink)`, hard shadow `2px 2px 0 var(--ink)`.
- **Top Bar:** Fixed/sticky height `64px`, border-bottom `2px solid var(--ink)`, background `--surface`.
  - Page Title (H1 Space Grotesk).
  - Contextual period filter (on Dashboard and Reports).
  - Global `+ Tambah` quick action menu button.
  - User avatar and account dropdown menu (Profile, Settings, Logout).
- **Main Content Area:** Max width container, 12-column CSS grid, padding `24px` to `32px`.

### 3.3 Mobile Shell Specification

- **Compact Header:** Height `56px`, sticky top, background `--surface`, border-bottom `2px solid var(--ink)`.
  - Wordmark or app icon on left.
  - Page title in center.
  - User avatar / profile button on right.
- **Bottom Navigation Bar:** Height `64px` + safe-area-inset-bottom, sticky bottom, background `--surface`, border-top `2px solid var(--ink)`, z-index 50.
  - Item 1: **Dashboard** (LayoutDashboard icon)
  - Item 2: **Transaksi** (ArrowLeftRight icon) — leads to combined or tabbed transactions
  - Item 3: **Barang** (Package icon)
  - Item 4: **Laporan** (BarChart3 icon)
  - Item 5: **Lainnya** (Menu / MoreHorizontal icon) — opens bottom drawer containing:
    - Pembelian (`/purchases`)
    - Hutang & Piutang (`/debts-receivables`)
    - Pengaturan (`/settings`)
    - Logout action
  - Touch targets: Minimum `44px x 44px`.
- **Data Table Transformation:**
  - Desktop: Dense TanStack Table with multiple columns, sorting, pagination.
  - Mobile: TanStack Table view hidden (`hidden md:block`); Mobile Card List displayed (`block md:hidden`).
  - No horizontal scrolling tables allowed for primary workflows.

---

## 4. Complete Page Specifications

### 4.1 Login Page (`/login`)

- **Job:** Authenticate household member securely and access shared household data.
- **Layout:** Centered card (`max-w-md`), border `2px solid var(--ink)`, shadow `6px 6px 0 var(--ink)`, background `--surface`.
- **UI Elements:**
  - Wordmark: "RumahKita"
  - Headline: "Urus rumah bareng-bareng." (Space Grotesk, bold).
  - Subtitle: "Masuk untuk mencatat keuangan dan kebutuhan rumah."
  - Form fields:
    - `Email` (type `email`, permanent visible label, placeholder `nama@contoh.id`, required).
    - `Password` (type `password`, permanent visible label, toggle show/hide password icon).
  - Action CTA: Button `Masuk` (full width, background `--primary`, border `2px solid var(--ink)`, shadow `4px 4px 0 var(--ink)`, loading spinner on submit).
  - Link: "Lupa password?" leading to password reset flow (`/forgot-password`).
  - Explicit constraint: NO public registration / signup button or link (accounts are created exclusively via owner invitation).

### 4.2 Dashboard (`/dashboard`)

- **Job:** Provide an instant, trustworthy overview of the household's current financial health and urgent replenishment needs.
- **Header:**
  - Greeting / Title: "Keuangan rumah bulan ini" (or selected period name).
  - Period Selector dropdown/tabs: `Bulan ini` (default), `Bulan sebelumnya`, `Tahun ini`, `Rentang kustom`.
- **4 Primary Stat Cards Grid:**
  1. **Total Pemasukan:** Nominal IDR formatted (e.g., `Rp 18.500.000`), icon ArrowDownLeft, optional comparison with previous period.
  2. **Total Pengeluaran:** Nominal IDR formatted (e.g., `Rp 12.350.000`), icon ArrowUpRight.
  3. **Sisa Arus Kas:** Net cash flow (Pemasukan minus Pengeluaran, e.g., `Rp 6.150.000`). Clearly labeled "Sisa arus kas", not "Profit". Tabular numbers. Neutral or contextual styling (not blindly green).
  4. **Hutang & Piutang Terbuka:** Summary of active liabilities/receivables (e.g., `Hutang: Rp 1.500.000 · Piutang: Rp 500.000` or count of open records).
- **Visualization Panel:**
  - Recharts monthly bar chart: Inflow vs Outflow comparison for the current month or 6-month trailing period.
  - Accessible contrast, clear tooltips formatted in IDR, legend in plain Indonesian ("Pemasukan", "Pengeluaran").
- **Dual Section Panels (Desktop side-by-side, Mobile stacked):**
  - **Panel 1: Transaksi Terbaru (Recent Transactions):**
    - List of latest 5–10 income and expense items.
    - Fields: Date, description/category, nominal (+/- formatted in IDR), recorded by avatar/initials.
    - Quick link: "Lihat semua transaksi →".
  - **Panel 2: Barang yang Perlu Dibeli (Low Stock Items):**
    - List of items where `quantity_on_hand <= low_stock_threshold`.
    - Shows item name, current stock + unit, threshold, badge `Menipis` or `Habis`.
    - Quick CTA button: `+ Buat Pembelian`.
- **Tertiary Panel: Jatuh Tempo Terdekat:**
  - List of debts/receivables approaching due date within 7 days or overdue.
- **Empty State:**
  - Displayed if zero transactions exist for the selected period.
  - Icon-based illustration (clean outline), copy: "Belum ada transaksi bulan ini."
  - Primary CTA: `Catat transaksi pertama`.

### 4.3 Pemasukan / Income Management (`/incomes`)

- **Job:** Fast, accurate recording and filtering of household income streams.
- **Top Controls:**
  - Page Title: "Pemasukan"
  - Summary Metric: Total Pemasukan in filtered period (`Rp XX.XXX.XXX`).
  - Action Button: `+ Tambah pemasukan` (opens drawer on desktop, navigates to full page on mobile).
  - Filter Bar: Date period picker, Sumber Pendapatan filter dropdown (Gaji, Freelance, Usaha, Hadiah), Kategori filter dropdown, Pencatat filter dropdown (Suami, Istri), Search box (notes/description).
- **Desktop Data Grid (TanStack Table):**
  - Columns:
    1. `Tanggal` (Formatted `DD MMM YYYY`, sortable)
    2. `Sumber Pendapatan` (Badge / text)
    3. `Kategori` (Optional badge)
    4. `Catatan` (Text, truncate with tooltip)
    5. `Pencatat` (Name/avatar)
    6. `Nominal` (Right-aligned, tabular-nums, `Rp XX.XXX.XXX`, bold)
    7. `Aksi` (Edit icon button, Archive/Delete icon button)
- **Mobile Card List View:**
  - Card layout for each record:
    - Header: Date and Sumber Pendapatan badge.
    - Body: Catatan description, Pencatat.
    - Footer: Prominent Nominal in bold IDR, Three-dot action menu.
- **Add / Edit Income Form:**
  - Form Fields:
    - `Tanggal` (Date input, defaults to today).
    - `Nominal` (Currency input, visual prefix `Rp`, masked with thousands separator, positive integer validation > 0).
    - `Sumber Pendapatan` (Select / Combobox, mandatory, with option to quickly add new source).
    - `Kategori Pemasukan` (Select, optional).
    - `Catatan` (Textarea, optional).
  - Validation: Nominal > 0, Sumber required.
  - Buttons: `Simpan Pemasukan` (Primary, loading state), `Batal` (Ghost/Secondary).

### 4.4 Pengeluaran / Expense Management (`/expenses`)

- **Job:** Categorize and track all money leaving the household, whether spent directly or generated via purchases.
- **Top Controls:**
  - Page Title: "Pengeluaran"
  - Summary Metric: Total Pengeluaran in period.
  - Action Button: `+ Tambah pengeluaran`.
  - Filter Bar: Period, Kategori (Makanan, Utilitas, Belanja Rumah, Transportasi, Pendidikan, Kesehatan), Metode Pembayaran (Tunai, Transfer Bank, E-Wallet, Kartu Kredit), Pencatat, Search.
- **Data Presentation:**
  - Desktop: TanStack Table with columns: Tanggal, Kategori (chip with outline), Metode Pembayaran, Catatan, Referensi Pembelian, Pencatat, Nominal, Aksi.
  - Mobile: Card list showing Date, Category badge, Payment method chip, Purchase link (if applicable), Nominal, Action menu.
- **Special Linking to Purchases:**
  - Expenses generated by the Purchase module display an explicit badge/link: `Lihat Pembelian #PO-XXXX`.
  - Visual indicator prevents users from creating a manual duplicate expense for items already recorded via Purchases.
- **Add / Edit Expense Form:**
  - `Tanggal` (Date, default today).
  - `Nominal` (IDR currency input, > 0).
  - `Kategori Pengeluaran` (Select, mandatory).
  - `Metode Pembayaran` (Select: Tunai, Transfer Bank, E-Wallet, Kartu Kredit, Lainnya).
  - `Catatan` (Textarea, optional).
  - Submit button: `Simpan Pengeluaran`.

### 4.5 Pembelian / Purchase Order Flow (`/purchases`)

- **Job:** Multi-item grocery and household supply acquisition linking inventory updates directly with financial expense tracking.
- **Workflow Steps:**
  1. **Header Details:** Tanggal pembelian, Toko / Vendor (optional text), Kategori Pengeluaran (mandatory), Metode Pembayaran (optional), Catatan (optional).
  2. **Dynamic Purchase Item Rows:**
     - User adds one or more line items via `+ Tambah Baris Barang`.
     - Fields per row:
       - `Barang` (Combobox with live search over master items; option to inline-create item if not existing).
       - `Kuantitas` (Number input, min 1, integer or decimal according to unit e.g., kg/liter).
       - `Satuan` (Read-only badge from selected item, e.g., pcs, kg, liter, botol).
       - `Harga Satuan` (IDR currency input).
       - `Subtotal` (Auto-calculated display: Kuantitas × Harga Satuan).
       - `Hapus Baris` (Trash icon button).
  3. **Total Calculation:**
     - Live calculated grand total displayed prominently in IDR.
     - Mobile: Sticky bottom bar displaying `Total: Rp XXX.XXX` alongside primary CTA.
  4. **Action Buttons:**
     - `Selesaikan pembelian` (Primary CTA, opens Confirmation Dialog).
     - `Simpan draft` (Secondary button, stores status as `Draft`).
     - `Batal` (Ghost button).
  5. **Pre-Completion Confirmation Dialog:**
     - Modal pops up showing:
       - Total Items count (e.g., "3 jenis barang, total 5 unit").
       - Total Nominal (e.g., "Rp 245.000").
       - **Stock Impact Preview Table:** Shows each item's current stock vs new stock after completion (e.g., "Minyak Goreng: 1 liter → 3 liter (+2)", "Beras: 2 kg → 7 kg (+5)").
       - Plain language explanation: "Sistem akan mencatat pengeluaran sebesar Rp 245.000 dan menambah stok barang otomatis."
       - Buttons: `Ya, Selesaikan` (Primary) and `Periksa Kembali` (Secondary).
  6. **Post-Completion State:**
     - Success banner with links to: `Lihat Pengeluaran Terbentuk` and `Lihat Daftar Barang`.

### 4.6 Barang / Inventori (`/inventory`)

- **Job:** Keep track of essential supplies, monitor depletion, prevent stockouts, and record manual adjustments with audit trails.
- **Top Overview Cards:**
  1. `Total Barang Aktif` (e.g., 42 barang)
  2. `Stok Menipis` (e.g., 3 barang — amber highlight)
  3. `Stok Habis` (e.g., 1 barang — red highlight)
- **Controls & Filters:**
  - Search input (live search by item name).
  - Status Filter: `Semua`, `Aman`, `Menipis`, `Habis`.
  - Category Filter.
  - Action Button: `+ Tambah Barang`.
- **Status Badges Standard:**
  - **Aman:** Green text/border, icon Check (✓), label "Aman" (`quantity_on_hand > low_stock_threshold`).
  - **Menipis:** Amber text/border, icon AlertTriangle (⚠), label "Menipis" (`0 < quantity_on_hand <= low_stock_threshold`).
  - **Habis:** Red text/border, icon XCircle (✕), label "Habis" (`quantity_on_hand <= 0`).
- **Desktop TanStack Table:**
  - Columns:
    1. `Nama Barang` (Bold, with category subtitle)
    2. `Kategori` (Chip)
    3. `Stok Saat Ini` (Large tabular-nums + unit, e.g., `4 liter`)
    4. `Batas Minimum` (Tabular-nums + unit, e.g., `2 liter`)
    5. `Lokasi Simpan` (Text, e.g., "Dapur", "Gudang")
    6. `Status` (Badges: Aman / Menipis / Habis)
    7. `Aksi` (Buttons: `Koreksi Stok`, `Detail / Edit`)
- **Mobile Card View:**
  - Card with item name, category chip, big stock number, status badge, and quick button `Koreksi`.
- **Item Detail View (`/inventory/[id]` or Drawer):**
  - Current stock level, low stock threshold, unit, location, notes.
  - Movement History Table: List of all stock movements with columns: Tanggal, Perubahan (+/-), Alasan (Pembelian, Pemakaian Rutin, Rusak/Kadaluarsa, Koreksi Fisik), Referensi Transaksi, Pengguna.
- **Koreksi Stok Dialog (Manual Adjustment):**
  - Displays current stock (e.g., `Stok saat ini: 4 botol`).
  - Input: `Stok Baru` (Number input, min 0).
  - Input: `Alasan Koreksi` (Select / Textarea, MANDATORY). Options: "Penyesuaian Fisik / Opname", "Barang Rusak / Bocor", "Kadaluarsa", "Lupa Dicatat", "Lainnya".
  - Explanatory diff preview: "Perubahan stok dari 4 botol menjadi 2 botol (-2 botol)."
  - Validation: Reason cannot be empty; stock cannot be negative.
  - Submit: `Simpan Koreksi Stok`.

### 4.7 Hutang & Piutang (`/debts-receivables`)

- **Job:** Manage money owed to others (Hutang) and money owed by others to the household (Piutang) with clear balance tracking and due-date alerts.
- **Top Tabs:**
  - Tab 1: `Hutang (Kewajiban Bayar)`
  - Tab 2: `Piutang (Hak Tagih)`
- **Summary Cards (Filtered by active tab):**
  1. `Total Saldo Terbuka` (Total unpaid balance)
  2. `Jatuh Tempo Dekat` (Count & nominal due within 7 days)
  3. `Terlambat / Overdue` (Count & nominal past due date with remaining balance > 0)
- **List / Table View:**
  - Desktop Columns: `Pihak Terkait` (Party name), `Deskripsi`, `Nominal Awal`, `Sisa Saldo`, `Jatuh Tempo`, `Status`, `Aksi`.
  - Statuses:
    - `Open` (Belum dibayar)
    - `PartiallyPaid` (Sebagian)
    - `Settled` (Lunas)
    - `Overdue` (Terlambat — prominent label + alert icon)
    - `Cancelled` (Dibatalkan)
- **Detail & Payment History View:**
  - Summary: Nominal awal, total terbayar, sisa saldo tersisa.
  - Payment History Table: Tanggal bayar, nominal bayar, metode pembayaran, catatan, dicatat oleh.
- **Payment Recording Dialog (`Catat Pembayaran` / `Catat Penerimaan`):**
  - Displays Sisa Saldo clearly (e.g., `Sisa saldo saat ini: Rp 700.000`).
  - Input `Tanggal Pembayaran` (Date).
  - Input `Nominal Pembayaran` (Currency IDR, > 0, strictly validated `<= sisa_saldo`).
  - Input `Metode Pembayaran` (Tunai, Transfer, dll.).
  - Input `Catatan` (Optional).
  - Inline error: If nominal entered exceeds remaining balance, displays error: "Nominal pembayaran tidak boleh melebihi sisa saldo (Rp 700.000)."
  - Button: `Simpan Pembayaran`.

### 4.8 Laporan (`/reports`)

- **Job:** Deliver visual, trustworthy financial summaries and exportable accounting data.
- **Controls:**
  - Tab Selector: `Laporan Bulanan` / `Laporan Tahunan`.
  - Period Filter: Year selector, Month selector.
  - Action CTA: Button `Ekspor CSV` (downloads `.csv` of aggregated or detailed records).
- **Summary Cards:**
  1. `Total Pemasukan`
  2. `Total Pengeluaran`
  3. `Arus Kas Bersih` (Pemasukan minus Pengeluaran)
     - Includes info tooltip / helper text: "Arus kas bersih dihitung dari total transaksi kas pemasukan dikurangi total transaksi kas pengeluaran pada periode terpilih."
- **Charts Section:**
  - **Chart 1:** Bar Chart — Tren Pemasukan vs Pengeluaran (Recharts).
    - Monthly view: daily/weekly breakdown or month-by-month trailing.
    - Yearly view: 12 months (Jan–Des).
    - *Zero-Value Handling:* Months with zero transactions MUST be rendered with a zero value bar/point so trend lines remain continuous and proportional.
  - **Chart 2:** Pie / Donut Chart or Ranked Bar Chart — Komposisi Kategori Pengeluaran.
  - **Chart 3:** Breakdown Chart — Pemasukan Berdasarkan Sumber Pendapatan.
- **Breakdown Data Tables:**
  - Table of Expense Categories with percentage of total expense.
  - Table of Income Sources with percentage of total income.
  - Summary of Debts & Receivables movements in period (Saldo Awal, Penambahan Baru, Pembayaran, Saldo Akhir).
  - Summary of Low Stock events & Purchases completed in period.

### 4.9 Pengaturan (`/settings`)

- **Job:** Configure household parameters, master data, notification channels, and security settings.
- **Sections:**
  1. **Profil & Rumah Tangga:**
     - User name, email.
     - Nama Rumah Tangga (e.g., "Keluarga Kami").
     - Timezone display (`Asia/Jakarta`) and Currency (`IDR`).
  2. **Anggota Rumah Tangga:**
     - Current members list (Role: Owner / Member).
     - Action: `+ Undang Pasangan` (Email invitation input).
  3. **Master Data Keuangan:**
     - Tabs or Accordion for `Sumber Pendapatan` and `Kategori Pengeluaran / Pemasukan`.
     - CRUD: Add new source/category, edit name, archive unused master items. Name unique per household validation.
  4. **Pengaturan Notifikasi Stok Rendah:**
     - Email Channel: Toggle enable/disable, destination email field.
     - WhatsApp Channel: Toggle enable/disable, WhatsApp phone number field (format `+62...`).
     - Information note: "Notifikasi WhatsApp menggunakan WhatsApp Business Platform resmi dan memerlukan persetujuan penerima."
     - Action Button: `Uji Notifikasi` (sends test message to configured active channels).
  5. **Keamanan & Sesi:**
     - Active sessions list (current device, browser, last active).
     - Action Button: `Keluar dari Semua Perangkat` (revokes all refresh tokens).
     - Logout button for current session.

---

## 5. UI Component Specifications

All UI components are built in `packages/ui` based on Radix UI / shadcn/ui primitives with opinionated Neo-brutalism design tokens.

### 5.1 Button Component

- **Variants:**
  - `primary`: Background `--primary` (`#C8F169`), text `--ink`, border `2px solid var(--ink)`, shadow `4px 4px 0 var(--ink)`.
  - `secondary`: Background `--surface` (`#FFFFFF`), text `--ink`, border `2px solid var(--ink)`, shadow `4px 4px 0 var(--ink)`.
  - `destructive`: Background `--danger` (`#B42318`), text `#FFFFFF`, border `2px solid var(--ink)`, shadow `4px 4px 0 var(--ink)`.
  - `ghost`: Background transparent, text `--ink`, no shadow, subtle hover state.
  - `outline`: White background, thin border, hover invert.
- **States:**
  - `loading`: Disables button, displays spinning loader icon, retains button width, shows "Menyimpan...", disables double-clicking.
  - `disabled`: Opacity 50%, cursor not-allowed, zero shadow translation.
  - `active`: Translate `(2px, 2px)`, shadow reduced to `2px 2px 0`.

### 5.2 Input / Select / Textarea Components

- **Visual Specs:**
  - Label: ALWAYS visible above the input, text `--ink`, font-medium (Inter 500). Never use placeholder as sole label.
  - Field: Background `--surface`, text `--ink`, border `2px solid var(--ink)`, radius `8px-10px`.
  - Focus Ring: `outline: 3px solid var(--secondary); outline-offset: 2px;`
  - Error State: Border `2px solid var(--danger)`, error text + icon AlertCircle rendered directly below field. Associated with `aria-describedby` and `aria-invalid="true"`.
  - Currency Input (`MoneyInput`): Permanent prefix `Rp` inside the input left edge, numeric keyboard on mobile (`inputMode="numeric"`), auto-formats display with dots as thousand separators.

### 5.3 Card & Stat Card Components

- **Visual Specs:**
  - Container: Background `--surface`, border `2px solid var(--ink)`, radius `10px`, hard shadow `4px 4px 0 var(--ink)`, padding `16px` to `24px`.
  - Stat Card Layout: Small uppercase/medium category label (muted), large display number in Space Grotesk / tabular-nums, contextual icon in top-right corner, optional footer comparison pill.

### 5.4 Badge / Status Tag Components

- **Visual Specs:**
  - Border: `1.5px` to `2px solid var(--ink)`.
  - Radius: `6px`.
  - Padding: `2px 8px` or `4px 10px`.
  - Font: Inter Medium, text-xs or text-sm.
  - Icons: Status MUST always bundle SVG icon + Text.
    - Aman: `bg-[#287D4F]/15 text-[#287D4F] border-[#287D4F]` + Check icon.
    - Menipis: `bg-[#9A5700]/15 text-[#9A5700] border-[#9A5700]` + AlertTriangle icon.
    - Habis: `bg-[#B42318]/15 text-[#B42318] border-[#B42318]` + XCircle icon.
    - Overdue: `bg-[#B42318]/15 text-[#B42318] border-[#B42318]` + Clock/Alert icon.

### 5.5 Dialog / Drawer Component

- **Visual Specs:**
  - Backdrop: `rgba(23, 23, 23, 0.6)` solid dark overlay (no blur).
  - Dialog Surface: Background `--surface`, border `2px solid var(--ink)`, shadow `6px 6px 0 var(--ink)`, radius `12px`.
  - Mobile behavior: Transforms into bottom drawer or full-screen overlay for forms with >3 fields to preserve keyboard visibility.
  - Header: Clear action-oriented title and close button (✕).
  - Footer: Cancel action (secondary/ghost) and Confirm action (primary) with distinct visual weights.

### 5.6 Toast & Notification Feedback

- **Visual Specs:**
  - Fixed position top-right (desktop) or top-center (mobile).
  - Border `2px solid var(--ink)`, hard shadow `4px 4px 0 var(--ink)`, radius `8px`.
  - Types:
    - `Success`: Green accent, CheckCircle icon, friendly confirmation message.
    - `Error`: Red accent, AlertOctagon icon, clear error reason + retry advice. No stack traces or raw database exceptions.
    - `Warning`: Amber accent, AlertTriangle icon.
  - Accessibility: Configured with `aria-live="polite"` or `aria-live="assertive"`.

---

## 6. Form Architecture & Validation Rules

- **Library Stack:** `react-hook-form` paired with `@hookform/resolvers/zod` and shared Zod schemas from `packages/contracts`.
- **Validation Execution:**
  - Trigger: `onBlur` for field-level feedback; `onSubmit` for comprehensive validation before network requests.
  - Error Display: Inline error message displayed immediately below the corresponding field.
  - Scroll-to-error: Auto-scrolls viewport to the first invalid field upon submit.
- **Mobile Sticky Action Bar:**
  - On viewports < 768px, long forms (e.g., Add Expense, Add Income, Purchase Order) feature a fixed bottom container (`sticky bottom-0 bg-surface border-t-2 border-ink p-4 z-40`) holding the primary submit button and total summaries. This prevents the submit button from getting lost beneath off-screen content.
- **Double-Submit Prevention:**
  - Form submit handlers toggle an `isSubmitting` / `isPending` state that disables all submit buttons and inputs, and displays an inline spinner.
  - Client generates or forwards an `Idempotency-Key` header on critical mutating actions (especially `complete purchase`).

---

## 7. Indonesian Localization & Copywriting

### 7.1 Locale & Formatting Specifications

- **Default Locale:** `id-ID`
- **Timezone:** `Asia/Jakarta` (WIB, UTC+7)
- **Currency Formatting Standard:**
  ```typescript
  export const formatIDR = (amount: number | bigint): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  };
  // Example output: "Rp 1.500.000"
  ```
- **Monetary Storage & Processing Rule:** Monetary values in API payloads and database are strictly integer Rupiah (`bigint` or `numeric(14,0)`), NEVER floating-point numbers.
- **Date Formatting Standards:**
  - Short: `27 Okt 2026` (`dd MMM yyyy`)
  - Long: `Selasa, 27 Oktober 2026` (`EEEE, dd MMMM yyyy`)
  - Relative: `2 jam yang lalu`, `Kemarin`, `Hari ini`

### 7.2 Copywriting Tone & Terminology Table

| UI Context | Prohibited / Cliché AI Copy | Authoritative Indonesian Household Copy |
|---|---|---|
| **Login Title** | "Selamat Datang di RumahKita" | "Urus rumah bareng-bareng." |
| **Login CTA** | "Sign In to Account" | "Masuk" |
| **Cash Flow Metric** | "Profit" / "Laba Bersih" | "Sisa arus kas" |
| **Dashboard Greeting** | "Overview Dashboard Analytics" | "Keuangan rumah bulan ini" |
| **Empty Transactions** | "No data available in table" | "Belum ada transaksi bulan ini." |
| **Empty Transactions CTA** | "Create New Item" | "Catat transaksi pertama" |
| **Empty Inventory** | "No inventory records" | "Belum ada barang di daftar. Tambahkan kebutuhan rumah yang ingin dipantau." |
| **Purchase Completion CTA** | "Submit Order" | "Selesaikan pembelian" |
| **Stock Status: Safe** | "In Stock" / "Green" | "Aman ✓" |
| **Stock Status: Low** | "Low Warning" | "Menipis ⚠" |
| **Stock Status: Out** | "Critical Out" | "Habis ✕" |
| **Stock Correction Action** | "Override Quantity" | "Koreksi stok" |
| **Debt Payment CTA** | "Pay Liability" | "Catat pembayaran" |
| **Receivable Payment CTA** | "Collect Asset" | "Catat penerimaan" |
| **Network/API Error** | "Internal Server Error 500" | "Pembelian belum tersimpan. Data tetap tersedia, silakan coba lagi." |
| **Stock Alert Notification** | "System Alert Threshold Triggered" | "Stok minyak goreng tinggal 1 liter (batas minimum 2 liter)." |

---

## 8. Frontend BFF Proxy Architecture

To simplify cookie authentication, bypass cross-subdomain CORS complexities, and shield backend API routes, the Next.js App Router functions as a Backend-For-Frontend (BFF).

```
[Browser Client]
       │
       │ HTTP /api/* (Same-origin cookies: refreshToken)
       ▼
[Next.js App Router BFF (apps/web)]
       │
       │ 1. Validate session & extract JWT
       │ 2. Forward request to NestJS /api/v1/* with Authorization: Bearer <token>
       │ 3. Intercept 401s -> refresh token via NestJS /auth/refresh -> retry
       │ 4. Map & sanitize error payloads
       ▼
[NestJS REST API (apps/api)]
```

### 8.1 Cookie & Token Management

- **Refresh Token:** Stored in an `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/` cookie. Inaccessible to client-side JavaScript.
- **Access Token:** Short-lived (15 minutes). Held in server-side BFF session or memory; attached to outgoing backend requests as `Authorization: Bearer <token>`.
- **Session Expiry & Rotation:** When an access token expires, the BFF calls `POST /api/v1/auth/refresh`. The NestJS backend rotates the refresh token (generating a new cookie) and issues a new access token. If refresh token reuse is detected, the session family is revoked and user is redirected to `/login`.

### 8.2 CSRF Protection

- Next.js route handlers validate incoming `Origin` and `Referer` headers against allowed domain hosts.
- State-modifying requests (`POST`, `PUT`, `DELETE`) require proper SameSite cookie constraints and optional anti-CSRF token headers.

---

## 9. Frontend Acceptance Criteria & Verification Matrix

| Area | Acceptance Criterion | Verification Method / Command | Pass Condition |
|---|---|---|---|
| **Auth Flow** | Two seeded users can log in and reach the Dashboard | Playwright test: fill email/pass, submit, verify URL `/dashboard` | Login succeeds; user avatar & household name visible |
| **Responsive (Mobile)** | Add Expense flow completes on 390px viewport | Playwright test: viewport `{ width: 390, height: 844 }`, fill expense form, submit | Form elements fit without horizontal scroll; sticky submit button visible; expense created |
| **Responsive (Desktop)** | Add Expense flow completes on 1280px viewport | Playwright test: viewport `{ width: 1280, height: 800 }`, fill expense form, submit | Layout displays 240px sidebar, 12-col grid, drawer form submits cleanly |
| **Data Presentation** | Expenses render as TanStack table on desktop and card list on mobile | Resize viewport across `768px`; inspect DOM | `<table>` element visible on desktop; `.expense-card` list visible on mobile |
| **Form Labels & Errors** | All form inputs have visible permanent labels and inline error messages | Inspect DOM; trigger empty submission | Labels remain above inputs; `aria-describedby` error element appears directly beneath invalid inputs |
| **Purchase Flow** | Purchase dialog displays item count, total nominal, and stock impact preview before completion | Fill purchase order with items, click "Selesaikan Pembelian", inspect confirmation dialog | Dialog shows accurate stock delta (e.g. `1 -> 3`); confirming creates 1 expense and updates stock |
| **Stock Badges** | Items display appropriate status badges: Aman, Menipis, Habis | Inspect inventory list with mock items having varying stock vs threshold | Badges render correct icon + text (✓ Aman, ⚠ Menipis, ✕ Habis) with WCAG AA contrast |
| **Debt Balance Check** | Recording a debt payment > remaining balance is prevented with inline error | Attempt to record payment of 800,000 on a debt with 700,000 remaining | Form blocks submission; shows error: "Nominal pembayaran tidak boleh melebihi sisa saldo" |
| **Reports & Export** | Reports render charts and trigger CSV download | Click "Ekspor CSV" on monthly/yearly reports | Browser triggers file download of formatted `.csv` with active period filter |
| **Design System** | Zero blurred shadows, borders are 2px ink, background is `#FFFDF7` | Inspect computed styles of cards and layout container | `box-shadow` has 0px blur; `border` is `2px solid rgb(23, 23, 23)`; `background-color` is `#FFFDF7` |

---

## 10. Complete Features Discovered Table

Below is the exhaustive feature inventory for the Frontend and UI/UX domain of RumahKita, systematically extracted from authoritative sources.

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Design System | Neo-brutalism Palette Tokens | CSS variables for background, surface, ink, primary, secondary, accent, lavender, status | CSS variable declarations | Standardized colors across app | Fallback to base colors | `Doc/design.md` §2 |
| 2 | Design System | Neo-brutalism Elevation & Hard Shadows | Unblurred solid shadows (`4px 4px 0 var(--ink)`) and active translations | CSS `box-shadow` rules | Distinctive card & button elevation | Fallback flat border | `Doc/design.md` §2 |
| 3 | Design System | Typography System | Space Grotesk for headings, Inter for body, tabular-nums for figures | Font stylesheet & CSS classes | Highly legible financial hierarchy | System sans-serif fallback | `Doc/design.md` §2 |
| 4 | Layout | Desktop Shell | Fixed sidebar (240px), top bar, 12-col grid, max-w container | Route navigation & window resize | 1280px optimized desktop view | Responsive collapse | `Doc/design.md` §3 |
| 5 | Layout | Mobile Shell | Compact top header, 5-item bottom nav (4 items + Lainnya menu) | Route navigation & touch events | 390px mobile-first layout | Scrollable content | `Doc/design.md` §3 |
| 6 | Layout | Table-to-Card Responsive Pattern | TanStack Table on desktop automatically morphs into card list on mobile | Screen width (<768px) | Zero horizontal scrolling data view | Table fallback | `Doc/design.md` §3 |
| 7 | Auth | Login Form | Centered card, email & password inputs, remember session | Email, Password | JWT session cookie, redirect | Inline error: "Email atau password salah" | `Doc/design.md` §4.1 |
| 8 | Auth | Forgot Password Flow | One-time token password reset link request | Email address | Reset email dispatched | Inline error on invalid email | `Doc/prd.md` §6.1 |
| 9 | Dashboard | 4 Core Stat Cards | Pemasukan, Pengeluaran, Sisa arus kas, Hutang & piutang terbuka | Backend dashboard aggregation | Formatted IDR metric cards | Skeleton loader / error retry | `Doc/design.md` §4.2 |
| 10 | Dashboard | Period Selector | Quick switcher: Bulan ini, Bulan sebelumnya, Tahun ini, Kustom | Date picker / dropdown click | Refetches dashboard metrics | Defaults to current month | `Doc/design.md` §4.2 |
| 11 | Dashboard | Income vs Expense Chart | Recharts bar chart comparing monthly inflow and outflow | Monthly aggregation dataset | High-contrast visual bar chart | "Belum ada data grafik" fallback | `Doc/design.md` §4.2 |
| 12 | Dashboard | Recent Transactions Panel | List of latest 5-10 income & expense records with quick link | Transaction stream | Mini list with +/- IDR formatting | "Belum ada transaksi" empty state | `Doc/design.md` §4.2 |
| 13 | Dashboard | Low Stock Items Panel | List of items at or below threshold with quick purchase CTA | Inventory filter | Item list with status badge & action | "Semua stok aman" confirmation | `Doc/design.md` §4.2 |
| 14 | Dashboard | Due Soon Debt Panel | List of liabilities/receivables due within 7 days | Debt filter | Mini due date summary list | Hidden if zero due | `Doc/design.md` §4.2 |
| 15 | Incomes | Income Table & Filters | Search, date filter, source filter, category filter, user filter | Filter query params | Filtered TanStack Table | Empty filter result message | `Doc/design.md` §4.3 |
| 16 | Incomes | Add/Edit Income Drawer/Page | Form: Tanggal, Nominal (IDR), Sumber, Kategori, Catatan | Form input data | Creates/updates income record | Field validation errors | `Doc/design.md` §4.3 |
| 17 | Expenses | Expense Table & Filters | Filter by period, category chips, payment method, user | Filter query params | Filtered TanStack Table | Empty filter state | `Doc/design.md` §4.4 |
| 18 | Expenses | Purchase Origin Linking | Explicit badge/link "Lihat pembelian #ID" on purchase-derived expenses | Expense metadata `purchase_id` | Navigates to purchase details | Link disabled if draft/deleted | `Doc/design.md` §4.4 |
| 19 | Purchases | Dynamic Item Row Editor | Add/remove items with live subtotal calculation | Item select, quantity, unit price | Auto-updated rows & grand total | Disallows negative quantity/price | `Doc/design.md` §4.5 |
| 20 | Purchases | Item Search Combobox | Live search over inventory items with unit auto-fill | Search keyword | Filtered item dropdown | "Barang tidak ditemukan" | `Doc/design.md` §4.5 |
| 21 | Purchases | Sticky Total Bottom Panel | Mobile view sticky bar showing total nominal and complete CTA | Live computed total | Sticky footer on small viewports | Disables button if empty rows | `Doc/design.md` §4.5 |
| 22 | Purchases | Pre-Completion Dialog & Stock Preview | Modal displaying item count, total nominal, and stock impact preview | "Selesaikan pembelian" click | Diff modal (e.g. 1 -> 3 liter) | Requires explicit user confirm | `Doc/design.md` §4.5 |
| 23 | Purchases | Draft Save & Cancel | Ability to save purchase order as Draft without affecting stock | "Simpan draft" / "Batalkan" | Purchase record saved with Draft status | Retains input on failure | `Doc/design.md` §4.5 |
| 24 | Inventory | Inventory Table & Search | Name search, category filter, stock status filter | Search text, status filters | TanStack Table with status badges | Empty state with "+ Tambah" CTA | `Doc/design.md` §4.6 |
| 25 | Inventory | Stock Status Badges | Visual indicator: Aman ✓ (green), Menipis ⚠ (amber), Habis ✕ (red) | `quantity` vs `threshold` | WCAG AA accessible badge | Fallback text badge | `Doc/design.md` §4.6 |
| 26 | Inventory | Item Detail & Stock History | View item details, unit, location, and chronological movement audit | Item ID | Movement history data table | "Belum ada pergerakan stok" | `Doc/design.md` §4.6 |
| 27 | Inventory | Stock Correction Dialog | Manual stock adjustment dialog with MANDATORY reason field | New quantity, mandatory reason | Creates `stock_movements` record | Validation error if reason empty | `Doc/design.md` §4.6 |
| 28 | Debts | Hutang & Piutang Tabs | Tabbed interface switching between Payables and Receivables | Tab click | Filtered list & summary cards | Tab state preserved | `Doc/design.md` §4.7 |
| 29 | Debts | Overdue Badge & Alert | Auto-calculated status if `due_date < now` and `balance > 0` | Due date, remaining balance | Red overdue badge with alert icon | Status reverts when settled | `Doc/design.md` §4.7 |
| 30 | Debts | Payment Recording Dialog | Dialog to record partial/full payment with balance constraint | Tanggal, nominal, metode, catatan | Updates balance, sets status | Error if nominal > balance | `Doc/design.md` §4.7 |
| 31 | Reports | Monthly / Yearly Reports Tab | Toggle between monthly granular view and 12-month annual view | Period tab switch | Aggregated summaries & charts | Fallback to current year | `Doc/design.md` §4.8 |
| 32 | Reports | Net Cash Flow Tooltip | Info popover explaining the exact calculation of net cash flow | Hover / click on info icon | Plain text definition tooltip | Closes on click away | `Doc/design.md` §4.8 |
| 33 | Reports | Zero-Value Month Rendering | Renders 0-value bars/points for empty months in annual view | Annual dataset | Continuous chronological chart | No missing month gaps | `Doc/design.md` §4.8 |
| 34 | Reports | CSV Data Export | Client triggers download of filtered dataset as `.csv` file | "Ekspor CSV" button click | Browser file download | Error toast if export fails | `Doc/design.md` §4.8 |
| 35 | Settings | Member Invitations | Invite spouse to join household via email | Spouse email address | Invitation record created | Error if email already member | `Doc/prd.md` §6.1 |
| 36 | Settings | Financial Master Data CRUD | Add/edit/archive income sources and expense categories | Name, type | Updated master options in forms | Error on duplicate name | `Doc/design.md` §4.9 |
| 37 | Settings | Notification Preferences Form | Configure Email & WhatsApp channels, input contact info | Toggle channels, phone/email | Updates notification config | Phone format validation (+62) | `Doc/design.md` §4.9 |
| 38 | Settings | Test Notification Button | Triggers test message to configured active channels | Button click | Verification toast (sent/failed) | Actionable failure toast | `Doc/design.md` §4.9 |
| 39 | Settings | Active Session Management | View logged in sessions and trigger "Logout All Devices" | Button click | Revokes sessions, redirects | Retains current session if desired | `Doc/prd.md` §6.1 |
| 40 | UI Primitives | Accessible Neo-brutalist Buttons | Primary, secondary, destructive, ghost variants with 120ms physics | User click / keyboard space | Visual push down `(2px, 2px)` | Loading spinner prevents re-click| `Doc/design.md` §5 |
| 41 | UI Primitives | Accessible Form Fields | Permanent labels, 2px ink border, 3px secondary focus ring, inline error | User text input | Styled input with ARIA links | Border turns red, error text below | `Doc/design.md` §5 |
| 42 | UI Primitives | Currency IDR Input Mask | Automatically prefixes `Rp` and formats thousand separator dots | Number keystrokes | Visual `Rp 150.000`, raw `150000` | Rejects non-numeric characters | `Doc/design.md` §5 |
| 43 | UI Primitives | Toast Notification System | Neo-brutalist toasts with icon, title, description, and action button | Event trigger | Top-right/top-center banner | Auto-dismisses after 4-5s | `Doc/design.md` §5 |
| 44 | BFF Proxy | Next.js API Rewrite & Error Handler | Proxies `/api/*` to NestJS, injects Bearer token, sanitizes errors | Client fetch request | Clean JSON response | Normalizes HTTP 4xx/5xx errors | `plan.md` Subagent 0D |

---

## 11. Edge Cases & Boundary Behaviors

| # | Feature | Input / Condition | Observed & Specified Behavior |
|---|---|---|---|
| 1 | Money Input Masking | User pastes string with mixed characters (e.g. `Rp 50.000,50-`) | Mask strips non-digit characters, ignores decimals, formats integer as `50000` and displays `Rp 50.000`. |
| 2 | Income / Expense Nominal | User submits nominal `= 0` or negative nominal (`-10000`) | Zod schema validation blocks submit; displays inline error: "Nominal harus lebih besar dari 0". |
| 3 | Mobile Long Form | Viewport width 390px, mobile virtual keyboard pops up | Sticky action bar shifts above keyboard; form container remains scrollable; focused input stays visible. |
| 4 | Purchase Item Duplication | User selects the same item twice in different rows of purchase order | Combobox disables already-selected items or warns user to merge quantities into a single row. |
| 5 | Purchase Item Row Deletion | User deletes rows until 0 rows remain, then clicks Complete | Submit button is disabled; displays helper message: "Tambahkan minimal satu barang untuk menyelesaikan pembelian." |
| 6 | Purchase Offline / Network Cut | Network drops while "Selesaikan pembelian" request is in flight | Error toast displayed: "Pembelian belum tersimpan. Data tetap tersedia, silakan coba lagi." User form inputs and line items remain completely intact (no data loss). Idempotency key prevents duplicate completion on retry. |
| 7 | Stock Correction to Zero | User corrects item stock to `0` with reason "Rusak semua" | Allowed. Status badge immediately updates to `Habis ✕` (red). Movement history logs negative adjustment with specified reason. |
| 8 | Stock Correction Negative | User attempts to adjust stock to `< 0` (e.g. `-2`) | Input validation blocks value; displays error: "Stok tidak boleh bernilai negatif." |
| 9 | Debt Overpayment | Debt remaining balance is `Rp 500.000`; user enters payment `Rp 600.000` | Client-side validation triggers immediately; submit disabled; error: "Nominal pembayaran tidak boleh melebihi sisa saldo (Rp 500.000)." |
| 10 | Debt Overdue Boundary | Due date is yesterday (`2026-10-26`), balance is `Rp 1` | Automatically displays status badge `Terlambat` with alert icon. If balance becomes `0`, status instantly switches to `Settled` (Lunas). |
| 11 | Annual Report Zero Months | Current year selected; months August to December have zero transactions | Annual chart displays all 12 months (Jan–Des); months with no activity show height 0 with clear 0-value tooltip, maintaining continuous chronological timeline without collapsing. |
| 12 | Rapid Double Click | User clicks "Masuk" or "Selesaikan pembelian" multiple times in 200ms | First click triggers `isSubmitting = true`, disabling button and showing loading spinner; subsequent clicks are ignored, preventing duplicate API requests. |
| 13 | Token Expiration During Edit | User leaves form open for 20 minutes (access token expired), then clicks Save | BFF proxy automatically intercepts 401 response, calls `/auth/refresh` using HttpOnly cookie, receives new access token, and retries original form submission transparently without user data loss. |
| 14 | Refresh Token Revocation | Refresh session revoked (e.g. spouse logged out all devices) | BFF fails refresh; redirects user to `/login` with toast notification: "Sesi telah berakhir, silakan masuk kembali." |
| 15 | Screen Resize Mid-Session | User rotates phone from portrait (390px) to landscape (844px) or resizes browser window | TanStack Table seamlessly switches between card list and table grid; active filter states and pagination position are fully preserved. |

---

## 12. Conclusion & Verification Strategy

The frontend specifications extracted from `Doc/design.md`, `Doc/prd.md`, `plan.md`, and `ORIGINAL_REQUEST.md` provide an exhaustive, unequivocal blueprint for implementation. All requirements—from the 11-token color palette and 4px/4px hard shadow Neo-brutalist aesthetic, to the 390px mobile responsiveness, TanStack Table-to-card conversions, Zod validation, Indonesian localized tone, and BFF proxy architecture—are fully cataloged.

Verification will be independently executable through:
1. Playwright end-to-end tests for mobile (390px) and desktop (1280px) viewports.
2. Automated visual regression checking for strict adherence to `#FFFDF7` background, 2px solid `#171717` borders, and unblurred drop shadows.
3. Form validation test suites validating IDR masking and boundary rejection (zero nominal, overpayments, negative stock).
