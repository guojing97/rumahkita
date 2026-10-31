# Technical Specification: 7 Core Pages & Forms (Next.js App Router)

**Document**: `pages_spec.md`  
**Milestone**: M4 — Frontend Web with Next.js App Router  
**Author**: `explorer_m4_pages_3`  
**Date**: 2026-10-27  
**Status**: COMPLETE SPECIFICATION  

---

## 1. Executive Overview & Design System Foundations

RumahKita is a private household finance and inventory web application designed for two household members (user and spouse). The frontend is built using Next.js 14+ App Router, TypeScript, Tailwind CSS with Neo-brutalism tokens, React Hook Form with Zod validation contracts from `@rumahkita/contracts`, TanStack Table for desktop grids, and Recharts for data visualizations.

### 1.1 Core Principles & Design Language
1. **Neo-brutalism Aesthetic**:
   - Main Background: `--bg: #FFFDF7` (Warm Cream / Off-white)
   - Surface / Card: `--surface: #FFFFFF`
   - Ink / Borders: `--ink: #171717` (Deep Charcoal Black, 2px solid border, 3px for hero accents)
   - Drop Shadows: Hard, unblurred drop shadows `4px 4px 0px var(--ink)` (cards/buttons), `6px 6px 0px var(--ink)` (dialogs/modals), `2px 2px 0px var(--ink)` (active/pressed states)
   - Primary Accent: `--primary: #C8F169` (Neon Lime)
   - Secondary Info: `--secondary: #B9D9FF` (Soft Blue)
   - Action Accent: `--accent: #FF8A65` (Coral Orange)
   - Border Radius: `8px` (buttons, inputs), `10px` (cards), `12px` (modals/drawers), `6px` (badges). *No fully rounded pills*.
2. **Typography & Financial Precision**:
   - Headings: `Space Grotesk` (weights 600, 700)
   - Body & UI: `Inter` (weights 400, 500, 600)
   - Financial Figures: Always formatted with `font-variant-numeric: tabular-nums` and Indonesian currency formatting:
     ```ts
     new Intl.NumberFormat('id-ID', {
       style: 'currency',
       currency: 'IDR',
       maximumFractionDigits: 0,
       minimumFractionDigits: 0,
     }).format(amount);
     ```
   - Raw amounts in forms and database are strictly integer Rupiah (`number` in TS, `numeric(14,0)` in PostgreSQL). Never floating point.
3. **Responsive Reflow Architecture**:
   - Viewport Breakpoints: Mobile (`<768px`, base `390px`), Tablet (`768px - 1023px`), Desktop (`>=1024px`, up to `1280px`).
   - **Table-to-Card Reflow**: All data tables (Transactions, Purchases, Inventory, Debts) render TanStack Table on desktop and high-density stacked card lists on mobile. Never force horizontal scrolling for core mobile workflows.
   - **Thumb-Friendly Touch Targets**: Minimum 44x44px for buttons and touch targets on mobile.
   - **Sticky Submits & Bottom Navigation**: Long forms on mobile use sticky bottom actions; 5-item fixed bottom navigation bar on mobile (`<1024px`).
4. **Accessible Brutalism & Friendly Indonesian Copy**:
   - Status indicators always combine color + icon + text (e.g. `Aman ✓`, `Menipis ⚠`, `Habis ✕`).
   - Copywriting uses natural, warm household Indonesian: `Pemasukan`, `Pengeluaran`, `Pembelian`, `Barang`, `Hutang`, `Piutang`, `Sisa arus kas`, `Catat pembayaran`, `Selesaikan pembelian`.

---

## 2. Page 1: `/dashboard` (Household Financial & Inventory Overview)

### 2.1 Route & Metadata
- **Route**: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- **Page Title**: "Dashboard Keuangan Rumah — RumahKita"
- **Breadcrumb/Heading**: "Ringkasan Rumah Tangga"

### 2.2 Data Fetching & Contract Mapping
- **Backend API**: `GET /api/v1/dashboard`
- **Query Parameters**:
  - `period`: `'this_month'` | `'last_month'` | `'this_year'` | `'custom'` (default: `'this_month'`)
  - `startDate`: `YYYY-MM-DD` (when `period=custom`)
  - `endDate`: `YYYY-MM-DD` (when `period=custom`)
- **Response Contract**: `dashboardSummaryResponseSchema` (from `@rumahkita/contracts`)
  ```ts
  interface DashboardSummaryResponse {
    period: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM';
    startDate: string;
    endDate: string;
    totalIncome: number;
    totalExpense: number;
    netCashFlow: number;
    openDebtsTotal: number;
    openReceivablesTotal: number;
    lowStockCount: number;
    outOfStockCount: number;
    recentTransactions: Array<{
      id: string;
      type: 'income' | 'expense';
      date: string;
      nominal: number;
      categoryOrSource: string;
      notes?: string | null;
      recordedByName?: string;
    }>;
    lowStockItems: Array<{
      id: string;
      name: string;
      unit: string;
      quantityOnHand: number;
      lowStockThreshold: number;
      status: 'SAFE' | 'LOW' | 'OUT';
    }>;
    dueSoonDebts: Array<{
      id: string;
      type: 'payable' | 'receivable';
      partyName: string;
      remainingBalance: number;
      dueDate: string;
      status: string;
    }>;
  }
  ```

### 2.3 Page Layout & Component Breakdown

```
+------------------------------------------------------------------------------------+
| Header: "Keuangan Rumah Bulan Ini"                 [ Periode: Bulan Ini v ]        |
+------------------------------------------------------------------------------------+
| [ 1. Total Pemasukan ] [ 2. Total Pengeluaran ] [ 3. Sisa Bersih ] [ 4. Stok Rendah ]|
|   Rp 15.000.000          Rp 8.500.000             Rp 6.500.000       3 Barang ⚠     |
+------------------------------------------------------------------------------------+
| Recharts Bar Chart: Perbandingan Arus Kas (Pemasukan vs Pengeluaran)               |
| [================== Pemasukan: Rp 15jt ==================]                          |
| [=========== Pengeluaran: Rp 8.5jt ===========]                                     |
+-------------------------------------------------+----------------------------------+
| 5. Transaksi Terbaru (5 Terakhir)               | 6. Peringatan Stok Menipis       |
| - Gaji Bulanan (+Rp 15.000.000)                 | - Beras Ramos (Tersisa: 2 kg ⚠)  |
| - Belanja Supermarket (-Rp 1.250.000)           | - Minyak Goreng (Habis: 0 L ✕)   |
| [ Lihat Semua Transaksi -> ]                    | [ Kelola Inventori -> ]          |
+-------------------------------------------------+----------------------------------+
| 7. Jatuh Tempo Hutang & Piutang Terdekat                                           |
| - Bayar Cicilan Motor: Sisa Rp 1.500.000 (Jatuh tempo 3 hari lagi)                 |
+------------------------------------------------------------------------------------+
```

#### A. Period Selector Component
- Styled as a neo-brutalism dropdown trigger with button border 2px ink, shadow `2px 2px 0 var(--ink)`.
- Options:
  1. `Bulan Ini` (`THIS_MONTH`) — default
  2. `Bulan Lalu` (`LAST_MONTH`)
  3. `Tahun Ini` (`THIS_YEAR`)
  4. `Pilih Tanggal...` (`CUSTOM` — opens date range popover).
- Changes trigger a query revalidation without full page reload.

#### B. 4 Summary Stat Cards
Grid layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`.
1. **Total Pemasukan (Total Income)**:
   - Icon: `TrendingUp` in a light green container (`#D1FAE5`).
   - Title: `Total Pemasukan`.
   - Nominal: `formatIDR(data.totalIncome)` in `text-2xl font-bold tabular-nums text-ink`.
   - Context sub-label: Periode aktif (e.g. "1 Okt - 31 Okt 2026").
2. **Total Pengeluaran (Total Expense)**:
   - Icon: `TrendingDown` in a soft coral container (`#FFE4E6`).
   - Title: `Total Pengeluaran`.
   - Nominal: `formatIDR(data.totalExpense)` in `text-2xl font-bold tabular-nums text-ink`.
   - Context sub-label: Termasuk pengeluaran belanja otomatis.
3. **Sisa Bersih (Arus Kas Bersih)**:
   - Icon: `Wallet` in a lavender container (`#EDE9FE`).
   - Title: `Sisa Arus Kas`.
   - Nominal: `formatIDR(data.netCashFlow)` in `text-2xl font-bold tabular-nums`.
   - Color logic: If `>= 0`, badge/text uses `--ink` with green indicator; if `< 0`, uses `--danger` (`#B42318`).
   - Tooltip: "Total pemasukan dikurangi total pengeluaran pada periode ini."
4. **Peringatan Stok Rendah (Low Stock Alert Count)**:
   - Icon: `AlertTriangle` in an amber container (`#FEF3C7`).
   - Title: `Perlu Belanja`.
   - Nominal: `${data.lowStockCount + data.outOfStockCount} Barang`.
   - Context: Breakdown pill: `${data.outOfStockCount} Habis · ${data.lowStockCount} Menipis`.
   - Click action: Direct link to `/inventori?status=LOW`.

#### C. Recharts Bar Chart: Arus Kas Pemasukan vs Pengeluaran
- Container: Card surface, border 2px ink, shadow `4px 4px 0 var(--ink)`, height 280px–320px.
- Chart Library: `Recharts` (`ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`).
- Data Structure:
  ```json
  [
    { "name": "Arus Kas", "Pemasukan": 15000000, "Pengeluaran": 8500000 }
  ]
  ```
- Visual Styling:
  - Bar `Pemasukan`: Fill `#C8F169` (Neon Lime), stroke `#171717`, strokeWidth 2.
  - Bar `Pengeluaran`: Fill `#FF8A65` (Coral/Accent), stroke `#171717`, strokeWidth 2.
  - Tooltip: Neo-brutalism card (`bg-white border-2 border-ink shadow-neo-sm p-3 text-sm font-semibold tabular-nums`).
  - Accessibility: `aria-label="Grafik perbandingan pemasukan dan pengeluaran"`.

#### D. Recent Transactions Widget (Last 5 Entries)
- Card displaying top 5 merged entries from `data.recentTransactions`.
- Row items:
  - Left: Icon badge (`ArrowDownLeft` green for income, `ArrowUpRight` coral for expense).
  - Center: Category or Source name (`font-semibold text-sm`), notes truncated, date formatted as `DD MMM YYYY`.
  - Right: Nominal formatted with `+` or `-` prefix (`tabular-nums font-bold text-sm`).
- Footer: Link button `Lihat Semua Transaksi →` pointing to `/transaksi`.
- Empty state: "Belum ada transaksi pada periode ini." + CTA button `Catat Transaksi Pertama`.

#### E. Low Stock Alert Widget
- Displays up to 5 items from `data.lowStockItems`.
- Row items:
  - Item name + unit.
  - Current stock count: `Stok: X / Min: Y`.
  - Badge: `Menipis ⚠` (`#FEF3C7`) or `Habis ✕` (`#FEE2E2`).
  - Action link: `+ Belanja` (navigates to `/belanja/baru?itemId=...`).
- Empty state: "Semua stok barang aman ✓. Belum ada kebutuhan yang menipis."

#### F. Due Soon Debts Panel
- Displays upcoming items from `data.dueSoonDebts`.
- Shows: Party name, Type (`Hutang` or `Piutang`), Remaining balance, Due date with relative badge (e.g., "Jatuh tempo hari ini", "3 hari lagi", or "Terlambat").
- Link: `Buka Hutang & Piutang →` pointing to `/hutang`.

---

## 3. Page 2: `/transaksi` (Incomes & Expenses Unified Hub)

### 3.1 Route & Layout Context
- **Route**: `apps/web/src/app/(dashboard)/transaksi/page.tsx`
- **Page Title**: "Transaksi Keuangan — RumahKita"
- **Primary CTAs**:
  - `+ Catat Pengeluaran` (Primary button: `--primary`, border 2px ink, shadow `4px 4px 0 var(--ink)`)
  - `+ Catat Pemasukan` (Secondary button: white surface, border 2px ink, shadow `4px 4px 0 var(--ink)`)

### 3.2 Data Endpoints & Schemas
- Incomes API: `GET /api/v1/incomes` (Query: `incomeQuerySchema`, Response: `IncomeResponse[]` with pagination `meta`)
- Expenses API: `GET /api/v1/expenses` (Query: `expenseQuerySchema`, Response: `ExpenseResponse[]` with pagination `meta`)
- Categories: `GET /api/v1/expense-categories` and `GET /api/v1/income-categories`
- Sources: `GET /api/v1/income-sources`
- Soft Delete APIs: `DELETE /api/v1/incomes/:id`, `DELETE /api/v1/expenses/:id`

### 3.3 Page Layout & Controls
1. **Unified Tabs**:
   - `Semua Transaksi` | `Pengeluaran` | `Pemasukan`
   - Active tab highlighted with `--primary` background, border 2px ink, hard shadow `2px 2px 0 var(--ink)`.
2. **Filters & Search Toolbar**:
   - Date range selector: `startDate` and `endDate`.
   - Category / Source select dropdown.
   - Payment method dropdown: `Semua Metode`, `Tunai`, `Transfer Bank`, `E-Wallet`, `Lainnya`.
   - Search input: debounced 300ms, searches notes and categories.
3. **Summary Metric Banner**:
   - Dynamically displays: `Total Pengeluaran: Rp X` and `Total Pemasukan: Rp Y` for the filtered view.

### 3.4 Table-to-Card Responsive Reflow

#### Desktop (`>=768px`): TanStack Table
Columns:
1. `Tanggal`: `YYYY-MM-DD` formatted as `14 Okt 2026` (`w-28`).
2. `Tipe`: Badge `Pemasukan` (green) or `Pengeluaran` (coral) (`w-28`).
3. `Kategori / Sumber`: Name with optional category color dot (`w-40`).
4. `Nominal`: Aligned right, `tabular-nums font-bold`, colored appropriately (`w-36`).
5. `Metode`: Chip badge (`Tunai`, `Transfer`, `E-Wallet`) (`w-28`).
6. `Catatan`: Truncated notes with tooltip on hover.
7. `Aksi`: Dropdown menu or buttons: `Edit`, `Hapus` (soft delete with confirmation).

#### Mobile (`<768px`): Stacked Card List
- High-density card per transaction:
  - Top line: Date (`14 Okt 2026`) + Type badge (`Pengeluaran`).
  - Middle: Category name (`Belanja Mingguan`) in bold + Notes below in muted text.
  - Bottom row: Payment method pill (`Transfer`) + Bold nominal (`Rp 450.000`) aligned right.
  - Touch target for editing/options: minimum 44x44px three-dot button in upper right.

### 3.5 Modals & Forms

#### Modal A: "Catat Pemasukan" (`income-modal.tsx`)
- Form Library: React Hook Form + `zodResolver(createIncomeSchema)`.
- Trigger: Button `+ Catat Pemasukan` or keyboard shortcut `Alt+I`.
- Schema Fields:
  ```ts
  const createIncomeSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    nominal: idrAmountSchema,
    sourceId: z.string().uuid('Sumber pendapatan wajib dipilih'),
    categoryId: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  });
  ```
- Form Controls:
  1. **Tanggal Transaksi**: `<input type="date">`, default `new Date().toISOString().split('T')[0]`.
  2. **Nominal (IDR)**: Neo-brutalism `IDRInput` component with `Rp` prefix. Displays formatted string with thousands separator (e.g., `5.000.000`), stores pure integer integer in form state. Disallows `<= 0` or `> 999.999.999.999`.
  3. **Sumber Pendapatan**: `<select>` dropdown populated from `GET /income-sources`. With quick action link to create new source if needed.
  4. **Kategori Pemasukan (Opsional)**: `<select>` populated from `GET /income-categories`.
  5. **Catatan (Opsional)**: `<textarea>` max 500 characters, counter indicator.
- Submit Action:
  - Button `Simpan Pemasukan` (disabled while submitting, shows spinner).
  - On 201 Created: Toast `Pemasukan berhasil dicatat!`, closes modal, revalidates transactions and dashboard.

#### Modal B: "Catat Pengeluaran" (`expense-modal.tsx`)
- Form Library: React Hook Form + `zodResolver(createExpenseSchema)`.
- Trigger: Button `+ Catat Pengeluaran` or keyboard shortcut `Alt+E`.
- Schema Fields:
  ```ts
  const createExpenseSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    nominal: idrAmountSchema,
    categoryId: z.string().uuid('Kategori pengeluaran wajib dipilih'),
    paymentMethod: z.enum(['cash', 'transfer', 'ewallet', 'other']).default('cash'),
    notes: z.string().max(500).optional(),
  });
  ```
- Form Controls:
  1. **Tanggal Transaksi**: `<input type="date">`.
  2. **Nominal (IDR)**: `IDRInput` component with live validation (`nominal > 0`).
  3. **Kategori Pengeluaran**: Mandatory select from `GET /expense-categories` (e.g. Makanan, Utilitas, Transport).
  4. **Metode Pembayaran**: Segmented button group / radio buttons: `Tunai`, `Transfer Bank`, `E-Wallet`, `Lainnya`.
  5. **Catatan (Opsional)**: `<textarea>`.
- Submit Action:
  - Button `Simpan Pengeluaran` (primary color).
  - On 201 Created: Toast `Pengeluaran berhasil dicatat!`, closes modal, revalidates list.

#### Modal C: Transaction Deletion Dialog (`transaction-delete-dialog.tsx`)
- Neo-brutalism alert dialog (2px ink border, hard shadow `6px 6px 0 var(--ink)`).
- Clear warning: "Apakah Anda yakin ingin menghapus catatan [Pemasukan/Pengeluaran] sebesar **[Nominal]**? Catatan ini akan diarsipkan dari laporan."
- Action Buttons: `Batal` (secondary) and `Hapus Transaksi` (destructive red `#B42318`).

---

## 4. Page 3: `/belanja` (Purchases & Procurement)

### 4.1 Route & Layout Context
- **Route**: `apps/web/src/app/(dashboard)/belanja/page.tsx`
- **Page Title**: "Daftar Belanja & Pembelian — RumahKita"
- **Primary CTA**: `+ Buat Pembelian Baru` (`/belanja/baru` or drawer)

### 4.2 Data Endpoints & Schemas
- Purchases List: `GET /api/v1/purchases` (`purchaseQuerySchema`, status: `draft` | `completed` | `cancelled`)
- Purchase Detail: `GET /api/v1/purchases/:id` (includes items array)
- Create Draft: `POST /api/v1/purchases` (`createPurchaseSchema`)
- Update Draft: `PUT /api/v1/purchases/:id` (`updatePurchaseSchema`)
- Atomic Complete: `POST /api/v1/purchases/:id/complete` (header/body `idempotencyKey`)
- Cancel Purchase: `POST /api/v1/purchases/:id/cancel` (`cancelPurchaseSchema` with `reason`)

### 4.3 Page Views & Status Navigation
- Status Tabs:
  - `Semua` | `Draf` (`draft`) | `Selesai` (`completed`) | `Dibatalkan` (`cancelled`)
- Purchases Table/Cards:
  - Shows: Tanggal, Vendor/Toko, Kategori Pengeluaran, Jumlah Item, Total Belanja (`formatIDR`), Status Badge:
    - `Draf`: Lavender/Blue badge (`bg-[#B9D9FF] text-ink`)
    - `Selesai`: Green badge (`bg-[#D1FAE5] text-[#065F46]`)
    - `Dibatalkan`: Muted grey badge (`bg-[#E5E5E5] text-[#66645F]`)
  - Actions for Draft: `Lanjutkan Draft`, `Batalkan`.
  - Actions for Completed: `Lihat Rincian` (displays linked expense and stock movements).

### 4.4 Draft Editor Flow (`purchase-draft-editor.tsx`)

Used on `/belanja/baru` or when editing an existing draft:
```
+------------------------------------------------------------------------------------+
| Form Header: "Draf Pembelian Kebutuhan Rumah"                                      |
+------------------------------------------------------------------------------------+
| Tanggal: [ 2026-10-27 ]    Toko / Vendor: [ Superindo Cinere             ]         |
| Kategori: [ Belanja Bulanan v ] Metode Bayar: (o) Tunai ( ) Transfer ( ) E-Wallet |
+------------------------------------------------------------------------------------+
| DAFTAR BARANG BELANJA                                                              |
| # | Barang (Inventori)       | Jml  | Harga Satuan (Rp) | Subtotal (Rp)  | Aksi    |
|---+--------------------------+------+-------------------+----------------+---------|
| 1 | [ Beras Ramos 5kg    v ] | [ 2] | [ 75.000        ] | Rp 150.000     | [ Hapus]|
| 2 | [ Minyak Goreng 2L   v ] | [ 3] | [ 34.000        ] | Rp 102.000     | [ Hapus]|
| 3 | [ Sabun Mandi (Baru)   ] | [ 5] | [  6.000        ] | Rp  30.000     | [ Hapus]|
+------------------------------------------------------------------------------------+
| [ + Tambah Baris Barang ]                                                          |
+------------------------------------------------------------------------------------+
| Catatan: [ Belanja bulanan akhir pekan                                           ] |
+------------------------------------------------------------------------------------+
| TOTAL ESTIMASI: Rp 282.000 (3 Macam Barang, 10 Unit)                               |
| [ Simpan Draf ]                                         [ Selesaikan Pembelian -> ]|
+------------------------------------------------------------------------------------+
```

#### Detailed Item Row Specifications
1. **Item Selector Combobox (`itemId` & `itemName`)**:
   - Autocomplete combobox searching existing items from `GET /items`.
   - If selected from inventory: populates `itemId`, sets `itemName` to item name, and shows current stock badge.
   - If free-text (non-inventory purchase): sets `itemId = null`, sets `itemName` to entered string.
2. **Kuantitas (`quantity`)**:
   - Integer number input with stepper (`-` and `+` buttons), minimum 1.
3. **Harga Satuan (`unitPrice`)**:
   - `IDRInput` component with `Rp` prefix, integer rupiah.
4. **Subtotal Baris**:
   - Calculated dynamically in real time: `quantity * unitPrice`.
   - Displayed in `tabular-nums font-bold text-ink`.
5. **Add/Remove Controls**:
   - Button `+ Tambah Baris Barang` appends an empty row.
   - Trash icon button removes the row (minimum 1 row required by validation).

### 4.5 "Selesaikan Pembelian" Modal (`complete-purchase-modal.tsx`)

This is the **critical atomic transaction** in the household workflow:
1. **Modal Content & Stock Impact Preview**:
   - Explains exactly what will happen in plain household language:
     > "Menyelesaikan pembelian ini akan:
     > 1. Mencatat pengeluaran otomatis sebesar **Rp [TotalAmount]** pada kategori **[CategoryName]**.
     > 2. Menambah stok untuk **[N] barang inventori**:"
   - Impact Table:
     | Barang | Jml Ditambah | Stok Saat Ini | Stok Setelah Belanja |
     | :--- | :--- | :--- | :--- |
     | Beras Ramos 5kg | +2 unit | 1 unit ⚠ | **3 unit ✓ (Aman)** |
     | Minyak Goreng 2L| +3 unit | 0 unit ✕ | **3 unit ✓ (Aman)** |
2. **Idempotency Key Generation**:
   - When the user opens or confirms the modal, the client generates a unique UUIDv4 idempotency key:
     ```ts
     const idempotencyKey = crypto.randomUUID();
     ```
   - Sent via header `idempotency-key: <UUID>` and body `{ idempotencyKey: "<UUID>" }`.
   - Even if the user rapidly double-clicks or experiences mobile network retries, the backend processes the transaction exactly once.
3. **On Completion**:
   - Shows success toast: "Pembelian berhasil diselesaikan! Stok telah diperbarui dan pengeluaran dicatat."
   - Redirects to `/belanja` with the purchase marked `Selesai`.

### 4.6 "Batalkan Draf" Modal (`cancel-purchase-modal.tsx`)
- Prompt dialog requiring a reason:
  - Form validation: `reason` string min 3 chars, max 500 chars (`cancelPurchaseSchema`).
  - Calls `POST /api/v1/purchases/:id/cancel`.

---

## 5. Page 4: `/inventori` (Items & Stock Management)

### 5.1 Route & Metadata
- **Route**: `apps/web/src/app/(dashboard)/inventori/page.tsx`
- **Page Title**: "Inventori & Stok Barang — RumahKita"
- **Primary CTA**: `+ Tambah Barang`

### 5.2 Data Endpoints & Schemas
- Items API: `GET /api/v1/items` (`itemQuerySchema`, params: `status`, `category`, `search`)
- Item Detail: `GET /api/v1/items/:id`
- Create Item: `POST /api/v1/items` (`createItemSchema`)
- Update Item: `PUT /api/v1/items/:id` (`updateItemSchema`)
- Adjust Stock: `POST /api/v1/items/:id/stock-adjustments` (`stockAdjustmentSchema`)
- Stock History: `GET /api/v1/items/:id/stock-adjustments`

### 5.3 Summary Badges & Quick Filters
Top summary banner displaying 3 clickable cards:
1. `Semua Barang`: Total count of active items.
2. `Stok Menipis`: Count of items where `quantityOnHand <= lowStockThreshold` and `> 0`. Badge styling: Amber `#FEF3C7`, ink `#92400E`, icon `AlertTriangle`.
3. `Stok Habis`: Count of items where `quantityOnHand <= 0`. Badge styling: Red `#FEE2E2`, ink `#991B1B`, icon `XCircle`.

### 5.4 Items Table & Mobile Card Reflow

#### Desktop (`>=768px`): TanStack Table
Columns:
1. `Nama Barang`: Name, unit (e.g. "Beras Ramos (5 kg)"), location tag.
2. `Kategori`: Category name (e.g. "Dapur", "Kebersihan").
3. `Stok Saat Ini`: Big bold number + unit (`tabular-nums font-bold text-base`).
4. `Batas Minimum`: Threshold indicator (e.g. "Min: 2").
5. `Status`: Distinct Status Badge:
   - `Aman ✓` (Green background `#D1FAE5`, ink `#065F46`, checkmark)
   - `Menipis ⚠` (Yellow/Amber background `#FEF3C7`, ink `#92400E`, warning icon)
   - `Habis ✕` (Red/Rose background `#FEE2E2`, ink `#991B1B`, cross icon)
6. `Aksi`:
   - Button `Sesuaikan Stok` (opens adjustment modal)
   - Button `Edit` (opens item update modal)
   - Button `Riwayat` (opens movements drawer)

#### Mobile (`<768px`): Stacked Card List
- Card content:
  - Top row: Item Name (`text-base font-bold`) + Status Badge right-aligned.
  - Middle: Category badge + Location chip (e.g. `Rak Dapur`).
  - Stock Counter Block:
    - `Stok Sekarang: [ X ] [Satuan]` (large font)
    - `Ambang Batas Minimum: [ Y ] [Satuan]`
  - Bottom row actions:
    - Button `Sesuaikan Stok` (50% width, min 44px height)
    - Button `Edit` (50% width, min 44px height)

### 5.5 Modals & Dialogs

#### Modal A: "Tambah Barang" (`item-modal.tsx`)
- Form Library: React Hook Form + `zodResolver(createItemSchema)`.
- Schema Fields:
  ```ts
  const createItemSchema = z.object({
    name: z.string().min(2, 'Nama barang minimal 2 karakter').max(150),
    category: z.string().max(100).optional(),
    unit: z.string().min(1, 'Satuan barang wajib diisi').max(30),
    quantityOnHand: z.coerce.number().int().min(0).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).default(0),
    location: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  });
  ```
- Form Controls:
  - `name`: Text input (placeholder: "Minyak Goreng Sania 2L").
  - `category`: Text input / select (e.g. "Bahan Pokok", "Kebersihan", "Obat").
  - `unit`: Text input (placeholder: "liter, pcs, kg, botol, pack").
  - `quantityOnHand`: Number input, default 0.
  - `lowStockThreshold`: Number input (ambang batas memicu status Menipis), default 1.
  - `location`: Text input (placeholder: "Kulkas, Lemari Dapur").
  - `notes`: Textarea.
- On success: Toast `Barang berhasil ditambahkan!`, invalidates inventory query.

#### Modal B: "Sesuaikan Stok Manual" (`stock-adjustment-modal.tsx`)
This handles manual stock corrections with strict safety checks:
1. **Context Header**:
   - Item Name: **[ItemName]**
   - Stok Saat Ini: **[quantityOnHand] [unit]**
2. **Delta Input & Adjustment Direction**:
   - Toggle switch / Radio buttons:
     - `(+) Tambah Stok` (masuk / barang ditemukan)
     - `(-) Kurangi Stok` (keluar / rusak / basi / hilang)
   - Input `Jumlah Perubahan`: positive integer (e.g. `2`).
   - Actual `delta` submitted: `+2` or `-2` (refuse `delta === 0`).
3. **Client-Side Negative Stock Pre-Check**:
   - If subtracting and `quantityOnHand - deltaMagnitude < 0`:
     - Disables submit button immediately.
     - Displays error alert: "Penyesuaian tidak valid: Stok akhir tidak boleh kurang dari 0 (Maksimal pengurangan: [quantityOnHand] [unit])."
   - Real-time Preview:
     - `Perubahan: [quantityOnHand] -> [resultingQuantity] [unit]`
     - New Status Preview: Shows resulting badge (`Aman`, `Menipis`, or `Habis`).
4. **Mandatory Reason Dropdown & Notes (`reason`)**:
   - Pre-filled options:
     - `manual_correction` ("Koreksi Manual / Salah Hitung")
     - `waste` ("Rusak / Basi / Tumpah / Kadaluarsa")
     - `purchase` ("Pembelian di Luar Sistem")
     - `initial` ("Penyesuaian Stok Awal")
     - `other` ("Alasan Lainnya...")
   - Validation: Minimum 3 characters, maximum 500 characters.
5. **Submission**:
   - Triggers `POST /api/v1/items/:id/stock-adjustments`.
   - On success: Toast `Stok barang berhasil disesuaikan!`, re-fetches inventory and dashboard.

#### Drawer C: "Riwayat Pergerakan Stok" (`stock-movements-drawer.tsx`)
- Slide-over sheet from right (desktop) or bottom sheet (mobile).
- Displays chronological list of movements for the item:
  - Date & Time.
  - Delta badge (`+5` in green, `-2` in red).
  - Resulting Quantity (`Stok Akhir: X`).
  - Reason (`Pembelian`, `Koreksi Manual`, etc.).
  - User who recorded the adjustment.

---

## 6. Page 5: `/hutang` (Debts & Receivables Management)

### 6.1 Route & Metadata
- **Route**: `apps/web/src/app/(dashboard)/hutang/page.tsx`
- **Page Title**: "Hutang & Piutang — RumahKita"

### 6.2 Data Endpoints & Schemas
- Debts API: `GET /api/v1/debts-receivables` (`debtReceivableQuerySchema`, params: `type`, `status`, `search`)
- Create Debt: `POST /api/v1/debts-receivables` (`createDebtReceivableSchema`)
- Update Debt: `PUT /api/v1/debts-receivables/:id` (`updateDebtReceivableSchema`)
- Record Payment: `POST /api/v1/debts-receivables/:id/payments` (`recordPaymentSchema`)
- Soft Delete: `DELETE /api/v1/debts-receivables/:id`

### 6.3 Dual-Tab Navigation & Summary Banners
1. **Segmented Tabs**:
   - `Hutang (Kewajiban Bayar)` (`type = payable`)
   - `Piutang (Hak Tagih)` (`type = receivable`)
2. **Summary Banner**:
   - **For Hutang**:
     - `Total Saldo Hutang`: Sum of `remainingBalance` of open payable records.
     - `Jatuh Tempo Dekat`: Count due within 7 days.
     - `Terlambat`: Count and total nominal of overdue debts.
   - **For Piutang**:
     - `Total Saldo Piutang`: Sum of `remainingBalance` of open receivable records.
     - `Belum Tertagih`: Count of active receivables.
3. **Primary CTA**:
   - In Hutang tab: `+ Catat Hutang Baru`
   - In Piutang tab: `+ Catat Piutang Baru`

### 6.4 Repayment Progress Bar & Status Badges
- **Repayment Progress Formula**:
  ```ts
  const paidAmount = principalAmount - remainingBalance;
  const progressPercent = Math.min(100, Math.max(0, Math.round((paidAmount / principalAmount) * 100)));
  ```
- **Neo-brutalism Progress Bar Component (`repayment-progress-bar.tsx`)**:
  - Container: 2px solid border, height 14px, radius 8px, background `#F5F5F0`.
  - Fill: `--primary: #C8F169` (for Hutang) or `--secondary: #B9D9FF` (for Piutang).
  - Label below:
    `Terbayar: Rp [paidAmount] dari Rp [principalAmount] ([progressPercent]%)`
- **Status Badges**:
  - `Belum Dibayar` (`open`): Lavender/Blue badge
  - `Sebagian` (`partially_paid`): Yellow/Amber badge
  - `Lunas` (`settled`): Green badge (`✓ Lunas`)
  - `Terlambat` (`overdue`): Red badge (`⚠ Terlambat`)

### 6.5 Debts Table & Cards Reflow
- Desktop Table Columns:
  1. `Pihak Terkait`: Party name (e.g. "Budi Santoso", "Bank BCA").
  2. `Deskripsi`: Purpose/notes.
  3. `Nominal Pokok`: Initial amount (`formatIDR`).
  4. `Sisa Saldo`: Current remaining balance (`formatIDR font-bold`).
  5. `Progres Pelunasan`: Neo-brutalism progress bar with percentage.
  6. `Jatuh Tempo`: Date formatted with warning indicator if close or overdue.
  7. `Status`: Badge (`Lunas`, `Sebagian`, `Terlambat`, etc.).
  8. `Aksi`:
     - Button `Catat Bayar` (if `remainingBalance > 0`).
     - Button `Riwayat Cicilan`.
- Mobile Cards:
  - Card per debt with party name, remaining balance in prominent large text, repayment progress bar, due date tag, and action button `Catat Pembayaran`.

### 6.6 Modals & Dialogs

#### Modal A: "Catat Hutang / Piutang Baru" (`debt-modal.tsx`)
- Form Library: React Hook Form + `zodResolver(createDebtReceivableSchema)`.
- Schema Fields:
  ```ts
  const createDebtReceivableSchema = z.object({
    type: z.enum(['payable', 'receivable']),
    partyName: z.string().min(2, 'Nama pihak terkait minimal 2 karakter').max(150),
    description: z.string().max(255).optional(),
    principalAmount: idrAmountSchema,
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
    notes: z.string().max(500).optional(),
  });
  ```
- Controls:
  - `type`: Hidden or tab-controlled (`payable` or `receivable`).
  - `partyName`: Text input (placeholder: "Nama orang / bank / institusi").
  - `principalAmount`: `IDRInput` component with `Rp` prefix.
  - `dueDate`: Date input (opsional).
  - `description`: Text input.
  - `notes`: Textarea.
- On success: Toast `Data hutang/piutang berhasil dibuat!`, re-fetches list.

#### Modal B: "Catat Pembayaran / Cicilan" (`payment-modal.tsx`)
This modal executes repayment with real-time balance validation:
1. **Context Header**:
   - Pihak: **[partyName]**
   - Jenis: **[Hutang / Piutang]**
   - Sisa Saldo Saat Ini: **Rp [remainingBalance]**
2. **Form Fields (`recordPaymentSchema`)**:
   ```ts
   const recordPaymentSchema = z.object({
     paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
     amount: idrAmountSchema,
     paymentMethod: z.enum(['cash', 'transfer', 'ewallet', 'other']).default('transfer'),
     notes: z.string().max(500).optional(),
   });
   ```
3. **Real-time Balance Validation**:
   - Client checks `amount > remainingBalance`:
     - Disables submit button.
     - Displays error in red box: "Nominal pembayaran (Rp [amount]) tidak boleh melebihi sisa saldo (Rp [remainingBalance])."
   - Preview Balance:
     - Shows: `Sisa saldo setelah pembayaran: Rp [remainingBalance - amount]`.
     - If `amount === remainingBalance`, displays green pill: "Status akan menjadi: Lunas ✓".
4. **Submission**:
   - Triggers `POST /api/v1/debts-receivables/:id/payments`.
   - On success: Toast `Pembayaran berhasil dicatat!`, closes modal, re-fetches list and dashboard.

---

## 7. Page 6: `/laporan` (Reports & Analytics)

### 7.1 Route & Metadata
- **Route**: `apps/web/src/app/(dashboard)/laporan/page.tsx`
- **Page Title**: "Laporan Keuangan & Ekspor CSV — RumahKita"

### 7.2 Data Endpoints & Schemas
- Monthly Report: `GET /api/v1/reports/monthly?year=YYYY&month=M` (`monthlyReportQuerySchema`, `monthlyReportResponseSchema`)
- Yearly Report: `GET /api/v1/reports/yearly?year=YYYY` (`yearlyReportQuerySchema`, `yearlyReportResponseSchema`)
- CSV Export: `GET /api/v1/reports/export/csv?type=...&startDate=...&endDate=...` (`csvExportQuerySchema`)

### 7.3 Report View Navigation
1. **Dual Tabs**:
   - `Laporan Bulanan` (`monthly`)
   - `Laporan Tahunan` (`yearly`)
2. **Toolbar Controls**:
   - For Bulanan: Month dropdown (Januari - Desember) + Year dropdown (2024 - 2030).
   - For Tahunan: Year dropdown (2024 - 2030).
   - Button `Unduh CSV` (`--accent` background, border 2px ink, download icon).

### 7.4 Monthly Report View (`monthly-report-view.tsx`)
1. **Summary Cards (3 Stat Cards)**:
   - `Total Pemasukan Bulanan`: `data.totalIncome` (`formatIDR`).
   - `Total Pengeluaran Bulanan`: `data.totalExpense` (`formatIDR`).
   - `Sisa Arus Kas Bersih`: `data.netCashFlow` with color indicator and definition tooltip:
     > "Arus kas bersih = Total pemasukan kas dikurangi total pengeluaran kas pada bulan ini."
2. **Daily Cash Flow Trend Chart (Recharts)**:
   - Bar / Area Chart mapping `dailyTrend` (`date`, `income`, `expense`).
   - XAxis: Days `1` to `31`.
   - Tooltip: Formatted IDR for that day.
3. **Expense by Category Breakdown**:
   - Two-column layout (desktop):
     - Left: Recharts Donut / Pie Chart showing percentages with category colors.
     - Right: Breakdown Table:
       | Kategori | Nominal | Porsi (%) | Batas Anggaran (Budget) | Status Anggaran |
       | :--- | :--- | :--- | :--- | :--- |
       | Belanja Dapur | Rp 3.200.000 | 45.2% | Rp 4.000.000 | [====== 80% ======] Aman |
       | Utilitas & Listrik | Rp 1.500.000 | 21.1% | Rp 1.200.000 | [====== 125% ====] Melebihi ⚠ |
4. **Income by Source Breakdown**:
   - Table showing Source name, Nominal, and Percentage of total income.

### 7.5 Yearly Report View (`yearly-report-view.tsx`)
1. **Zero-Month Continuity Guarantee**:
   - `GET /api/v1/reports/yearly` guarantees returning an array of exactly 12 months (Januari s/d Desember).
   - Months with no transactions explicitly contain `income: 0, expense: 0, net: 0`.
   - The chart will NEVER collapse or skip inactive months, ensuring complete visual continuity.
2. **12-Month Recharts Bar Chart (`yearly-continuity-chart.tsx`)**:
   - Grouped Bar Chart:
     - `Pemasukan`: Fill `#C8F169` (Lime), stroke `#171717`.
     - `Pengeluaran`: Fill `#FF8A65` (Coral), stroke `#171717`.
     - XAxis: `Jan`, `Feb`, `Mar`, `Apr`, `Mei`, `Jun`, `Jul`, `Agu`, `Sep`, `Okt`, `Nov`, `Des`.
3. **Yearly Summary Table**:
   - 12 rows with columns: Bulan, Pemasukan, Pengeluaran, Arus Kas Bersih, Akumulasi.

### 7.6 "Unduh CSV" Flow & RFC 4180 Formatting (`csv-export-button.tsx`)
1. **Trigger & Option Modal / Dropdown**:
   - User clicks `Unduh CSV`.
   - Options:
     - Tipe Transaksi: `Semua Transaksi` (`transactions`), `Hanya Pengeluaran` (`expenses`), `Hanya Pemasukan` (`incomes`).
     - Rentang Tanggal: `Bulan Ini`, `Tahun Ini`, atau `Kustom (Tanggal Mulai - Tanggal Selesai)`.
2. **Direct Browser Streaming Download**:
   - Client sends `GET /api/v1/reports/export/csv?type=transactions&startDate=...&endDate=...`.
   - Response headers:
     ```http
     Content-Type: text/csv; charset=utf-8
     Content-Disposition: attachment; filename="transaksi-rumahkita-transactions.csv"
     ```
   - Stream is downloaded directly by browser blob trigger.
3. **Indonesian RFC 4180 CSV Columns**:
   ```csv
   "Tanggal","Tipe","Kategori / Sumber","Nominal","Metode Pembayaran","Catatan","Pencatat"
   "2026-10-15","Pengeluaran","Belanja Bulanan","450000","Transfer Bank","Belanja di Superindo","User 1"
   "2026-10-25","Pemasukan","Gaji Kantor","15000000","Transfer Bank","Gaji Bulan Oktober","User 1"
   ```

---

## 8. Page 7: `/pengaturan` (Settings, Profile & Notification Preferences)

### 8.1 Route & Metadata
- **Route**: `apps/web/src/app/(dashboard)/pengaturan/page.tsx`
- **Page Title**: "Pengaturan Rumah Tangga — RumahKita"

### 8.2 Sub-Tabs Structure
The page is organized into 4 clear sections:
1. `Profil & Rumah Tangga`
2. `Kategori & Master Data`
3. `Kanal Notifikasi`
4. `Keamanan & Sesi`

### 8.3 Section 1: Profil & Rumah Tangga
1. **Household Details Form**:
   - Household Name (`name`): editable by Owner (`PUT /api/v1/household`).
   - Currency: `IDR (Rupiah)` (read-only info pill).
   - Timezone: `Asia/Jakarta (WIB)` (read-only info pill).
2. **Household Members List (`GET /api/v1/household`)**:
   - Card per member showing:
     - Avatar / Initial circle (neo-brutalism 2px border).
     - Full Name & Email.
     - Role Badge: `Pemilik` (owner) in lime `#C8F169` or `Anggota` (member) in blue `#B9D9FF`.
     - Joined Date (`joinedAt`).
   - Owner actions: Button `Hapus Anggota` (`DELETE /api/v1/households/:id/members/:memberId`).
3. **"Undang Anggota" Modal (`member-invite-modal.tsx`)**:
   - Trigger: Button `+ Undang Anggota` (visible to Owner).
   - Schema: `inviteMemberSchema` (`email`, `role: 'member'`).
   - Submits to `POST /api/v1/households/:id/invite`.
   - On success: Toast `Undangan berhasil dikirim!`.

### 8.4 Section 2: Kategori & Master Data
Allows household members to manage master data:
1. **Sumber Pendapatan (Income Sources)**:
   - List from `GET /api/v1/income-sources`.
   - Modal "+ Tambah Sumber" (`createIncomeSourceSchema`: `name`, `description`).
   - Toggle active/inactive (`isActive`).
2. **Kategori Pengeluaran (Expense Categories)**:
   - List from `GET /api/v1/expense-categories`.
   - Modal "+ Tambah Kategori" (`createExpenseCategorySchema`: `name`, `budgetLimit`, `color`).
   - Allows setting monthly `budgetLimit` (IDR integer) for comparison in `/laporan`.
3. **Kategori Pemasukan (Income Categories)**:
   - List from `GET /api/v1/income-categories`.
   - Modal "+ Tambah Kategori" (`createIncomeCategorySchema`: `name`, `color`).

### 8.5 Section 3: Kanal Notifikasi Stok Rendah (`notification-preferences-form.tsx`)
1. **Data Endpoints**:
   - Fetch: `GET /api/v1/settings/notifications`
   - Update: `PUT /api/v1/settings/notifications` (`updateNotificationPreferenceSchema`)
2. **Form Fields**:
   - **Email Notification Channel**:
     - Toggle Switch: `Aktifkan Notifikasi Email` (`emailEnabled: boolean`).
     - Input Field: `Alamat Email Penerima` (`emailAddress: string`).
     - Validation: Valid email format (`z.string().email()`).
     - Helper text: "Email peringatan otomatis akan dikirim jika stok barang berkurang menjadi Menipis atau Habis."
   - **WhatsApp Notification Channel**:
     - Toggle Switch: `Aktifkan Notifikasi WhatsApp` (`whatsappEnabled: boolean`).
     - Input Field: `Nomor WhatsApp Penerima` (`whatsappNumber: string`).
     - Validation: Regex pattern `^\+62[0-9]{8,15}$`.
     - Warning Notice Box:
       > "Notifikasi WhatsApp menggunakan integrasi resmi WhatsApp Business / Cloud API. Nomor harus diawali kode negara +62 (contoh: +628123456789). Layanan ini tidak menggunakan bot WhatsApp Web tidak resmi."
3. **Submit Button**:
   - Button `Simpan Preferensi Notifikasi` (`--primary`, hard shadow).
   - On success: Toast `Preferensi notifikasi berhasil disimpan!`.

### 8.6 Section 4: Keamanan & Sesi
1. **Informasi Akun**:
   - Nama Pengguna, Email Login.
2. **Aksi Sesi**:
   - Button `Keluar dari Perangkat Ini` (Secondary style): calls `POST /api/v1/auth/logout`, clears cookies, redirects to `/login`.
   - Button `Cabut Semua Sesi Aktif` (Destructive style): calls `POST /api/v1/auth/logout-all`, revokes all refresh token sessions across devices.

---

## 9. Shared Form Engineering & Validation Protocols

### 9.1 IDR Currency Input Component (`idr-input.tsx`)
To prevent numeric drift, floating point errors, or bad user inputs:
1. Form state binds to a raw integer: `value: number` (e.g. `250000`).
2. Input display is formatted with thousands separator: `"Rp 250.000"`.
3. User keystroke handler:
   - Strips all non-digit characters.
   - Parses integer: `parseInt(cleaned, 10)`.
   - Enforces max boundary: `999_999_999_999` (IDR 999 Miliar).
   - Re-formats display on blur; shows raw digits or clean prefix on focus.
4. Complies with `@rumahkita/contracts`:
   - `idrAmountSchema`: rejects `<= 0`, floats, and booleans.

### 9.2 Standardized Backend Error Envelope Handling
All form submissions and API queries catch and render backend errors using the standard envelope:
```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": [
    { "field": "amount", "issue": "Nominal pembayaran melebihi sisa saldo" }
  ]
}
```
Client error handling logic (`apps/web/src/lib/api-client.ts`):
1. Maps `details[].field` directly to React Hook Form field errors:
   ```ts
   details.forEach(({ field, issue }) => {
     setError(field as any, { type: 'server', message: issue });
   });
   ```
2. Displays toast notification with error title and description.
3. **Never loses form input** when a network or validation error occurs.

### 9.3 State Feedback & Accessibility Standards
1. **Loading Skeletons**:
   - High-contrast Neo-brutalism skeletons: `border-2 border-ink bg-[#F5F5F0] animate-pulse rounded-card`.
2. **Empty States**:
   - Standard empty component with simple icon, concise headline, explanatory body, and direct CTA button (e.g., "Belum ada transaksi bulan ini" -> `Catat Transaksi Pertama`).
3. **WCAG AA Compliance**:
   - Dark charcoal text `#171717` on `#FFFDF7` and `#FFFFFF` exceeds 14:1 contrast ratio.
   - Visible focus outline: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#171717] focus-visible:ring-offset-2`.
   - `prefers-reduced-motion` strictly honored in CSS.

---

## 10. Code Layout & File Directory Index

The Next.js App Router workspace (`apps/web/src/`) is organized as follows:

```text
apps/web/src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx                      # Login page
│   │   └── layout.tsx                        # Centered single-column auth layout
│   ├── (dashboard)/
│   │   ├── layout.tsx                        # Fixed desktop sidebar + sticky mobile topbar & bottom nav
│   │   ├── dashboard/
│   │   │   └── page.tsx                      # Page 1: Dashboard
│   │   ├── transaksi/
│   │   │   └── page.tsx                      # Page 2: Transaksi (Incomes & Expenses)
│   │   ├── belanja/
│   │   │   ├── page.tsx                      # Page 3: Belanja (Purchases list & filters)
│   │   │   └── baru/
│   │   │       └── page.tsx                  # Page 3: Purchase Draft Editor
│   │   ├── inventori/
│   │   │   └── page.tsx                      # Page 4: Inventori (Items & Stock)
│   │   ├── hutang/
│   │   │   └── page.tsx                      # Page 5: Hutang & Piutang
│   │   ├── laporan/
│   │   │   └── page.tsx                      # Page 6: Laporan (Monthly/Yearly & CSV Export)
│   │   └── pengaturan/
│   │       └── page.tsx                      # Page 7: Pengaturan (Settings, Members, Notifications)
│   ├── api/
│   │   └── [...path]/
│   │       └── route.ts                      # BFF Proxy to NestJS API (http://127.0.0.1:4000/api/v1)
│   ├── globals.css                           # Neo-brutalism tokens, fonts, and reset
│   └── layout.tsx                            # Root HTML layout (Inter + Space Grotesk)
├── components/
│   ├── dashboard/
│   │   ├── stat-card.tsx                     # 4 summary cards
│   │   ├── cashflow-bar-chart.tsx            # Recharts bar chart
│   │   ├── recent-transactions-widget.tsx    # Last 5 transactions
│   │   ├── low-stock-alert-widget.tsx        # Low stock alert card
│   │   └── due-soon-debts-widget.tsx         # Upcoming debt dues panel
│   ├── transaksi/
│   │   ├── transactions-table.tsx            # TanStack Table for desktop
│   │   ├── transactions-card-list.tsx        # Mobile stacked card list
│   │   ├── income-modal.tsx                  # Catat Pemasukan modal
│   │   ├── expense-modal.tsx                 # Catat Pengeluaran modal
│   │   └── transaction-delete-dialog.tsx     # Soft delete confirmation dialog
│   ├── belanja/
│   │   ├── purchases-table.tsx               # Desktop purchases table
│   │   ├── purchases-card-list.tsx           # Mobile purchases card list
│   │   ├── purchase-draft-editor.tsx         # Draft form & dynamic item rows
│   │   ├── purchase-item-row.tsx             # Single item row with auto-subtotal
│   │   ├── complete-purchase-modal.tsx       # Atomic completion & stock increment preview
│   │   └── cancel-purchase-modal.tsx         # Cancel draft dialog with reason
│   ├── inventori/
│   │   ├── inventory-table.tsx               # Desktop inventory table
│   │   ├── inventory-card-list.tsx           # Mobile inventory cards
│   │   ├── item-modal.tsx                    # Tambah / Edit barang modal
│   │   ├── stock-adjustment-modal.tsx        # Koreksi stok with negative check & mandatory reason
│   │   └── stock-movements-drawer.tsx        # Stock movement history slide-over
│   ├── hutang/
│   │   ├── debts-table.tsx                   # Desktop debts/receivables table
│   │   ├── debts-card-list.tsx               # Mobile debts card list
│   │   ├── debt-modal.tsx                    # Tambah Hutang/Piutang modal
│   │   ├── payment-modal.tsx                 # Catat Pembayaran with balance validation
│   │   └── repayment-progress-bar.tsx        # Neo-brutalism progress bar component
│   ├── laporan/
│   │   ├── monthly-report-view.tsx           # Monthly cards, trend chart, category table
│   │   ├── yearly-report-view.tsx            # Yearly 12-month continuity bar chart & table
│   │   ├── daily-trend-chart.tsx             # Daily cash flow Recharts chart
│   │   ├── yearly-continuity-chart.tsx       # 12-month continuity Recharts chart
│   │   ├── category-breakdown-table.tsx      # Expense category breakdown with budget comparison
│   │   └── csv-export-button.tsx             # RFC 4180 CSV export trigger & options
│   ├── pengaturan/
│   │   ├── household-profile-form.tsx        # Household settings & name update
│   │   ├── member-invite-modal.tsx           # Partner invitation modal
│   │   ├── master-data-section.tsx           # Sources & Categories management
│   │   └── notification-preferences-form.tsx # Email & WhatsApp toggle switches & inputs
│   ├── shared/
│   │   ├── idr-input.tsx                     # Formatted IDR currency input
│   │   ├── status-badge.tsx                  # Aman / Menipis / Habis / Lunas badges
│   │   ├── empty-state.tsx                   # Reusable empty states
│   │   ├── loading-skeleton.tsx              # Neo-brutalism skeleton loader
│   │   └── confirmation-dialog.tsx           # Reusable confirmation dialog
│   └── layout/
│       ├── desktop-sidebar.tsx               # Fixed 240px sidebar with active state
│       ├── mobile-topbar.tsx                 # 56px sticky top bar
│       ├── mobile-bottom-nav.tsx             # 64px fixed 5-item bottom nav
│       └── household-switcher.tsx            # Household indicator badge
└── lib/
    ├── api-client.ts                         # Fetcher wrapper with error envelope handling
    ├── formatters.ts                         # formatIDR, parseIDR, date formatting
    └── hooks/                                # Custom hooks for query and state
```

---

## 11. Verification Matrix

| Page / Component | Verified Contract / Requirement | Test / Invalidation Criteria |
| :--- | :--- | :--- |
| **Dashboard** | `dashboardSummaryResponseSchema` | All 4 summary cards match backend figures; chart renders Pemasukan vs Pengeluaran; low stock count matches inventory. |
| **Transaksi** | `createIncomeSchema`, `createExpenseSchema` | Input <= 0 rejected; category required on expense; table on desktop, cards on mobile; soft delete works. |
| **Belanja** | `createPurchaseSchema`, `completePurchaseSchema` | Dynamic item subtotal calculates correctly; completion modal displays stock increment preview; UUID idempotency key sent on complete. |
| **Inventori** | `createItemSchema`, `stockAdjustmentSchema` | Badges display `Aman ✓`, `Menipis ⚠`, `Habis ✕`; stock adjustment requires reason and blocks negative resulting stock. |
| **Hutang** | `createDebtReceivableSchema`, `recordPaymentSchema` | Repayment progress bar matches `(principal - remaining) / principal * 100%`; disallow payment > remaining balance. |
| **Laporan** | `monthlyReportQuerySchema`, `yearlyReportQuerySchema`, `csvExportQuerySchema` | Monthly report displays category breakdown with budget comparison; yearly chart preserves 12-month continuity with zero fill; CSV export triggers download. |
| **Pengaturan** | `inviteMemberSchema`, `updateNotificationPreferenceSchema` | Household members displayed; WhatsApp requires `+62` regex validation; email toggle updates preferences. |
