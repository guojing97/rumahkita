# Domain Specification & Blueprint: Business Modules & Transactions (NestJS /api/v1)

**Milestone**: M3 — Backend API (`apps/api`)  
**Target Directory**: `apps/api/src/modules/`  
**Author**: Explorer 3 (Business Domain & Transactions Explorer)  
**Date**: 2026-10-27  
**Status**: Ready for Implementation  

---

## 1. Executive Overview & Cross-Cutting Architecture

This specification defines the exhaustive blueprint for all business domain modules in the RumahKita NestJS REST API (`apps/api`). It details every controller, service method, database transaction, validation schema, query pattern, and error scenario across:
1. **Finance Module** (`income-sources`, `income-categories`, `expense-categories`, `incomes`, `expenses`)
2. **Inventory Module** (`items`, `stock-movements`, dynamic stock statuses, manual stock adjustments)
3. **Purchases Module** (`purchases`, `purchase-items`, idempotency handling, atomic completion transaction)
4. **Debts & Receivables Module** (`debts-receivables`, repayment payments, balance validation, overdue calculation)
5. **Dashboard & Reports Module** (`dashboard/summary`, monthly & yearly reports, Indonesian CSV export)
6. **Notification Preferences Module** (`notification-preferences`, outbox stock event emission)

### 1.1 Cross-Cutting Invariants

1. **Multi-Tenancy via `household_id`**:
   - Every domain query and command MUST strictly scope to `household_id` extracted from the verified JWT / `HouseholdGuard` (`req.household.id`).
   - Cross-household access returns `404 Not Found` (or `403 Forbidden` if tenant violation is explicitly tracked).
2. **Soft-Delete Master Data**:
   - Master data entities (`income_sources`, `income_categories`, `expense_categories`, `items`, `incomes`, `expenses`, `debts_receivables`) use `deleted_at TIMESTAMP WITH TIME ZONE`.
   - All standard queries MUST append `.where(isNull(table.deletedAt))`.
   - Unique indexes on names (e.g. `income_sources_household_name_idx`) are partial unique indexes filtered by `deleted_at IS NULL`.
3. **Monetary IDR Integrity**:
   - IDR values are stored as `numeric(14, 0)` in PostgreSQL and represented as integer Rupiah numbers in TypeScript contracts (`z.coerce.number().int().min(0)`).
   - Zero or negative nominals for transactions throw `422 Unprocessable Entity`.
   - Max nominal boundary is `999_999_999_999` (IDR 999 Miliar).
4. **Audit Columns**:
   - Every business mutation sets `created_by` / `updated_by` with the authenticated `req.user.id`.
   - Timestamps `created_at` and `updated_at` use UTC timezone with ISO-8601 serialization.
5. **Standard Response & Error Envelope**:
   - Success Envelope: `{ success: true, data: T, meta?: PaginationMeta, message?: string }`
   - Error Envelope: `{ success: false, statusCode: number, error: string, message: string | string[], errors?: Array<{ field?: string, message: string }> }`
   - Validation failure returns HTTP `422 Unprocessable Entity` (aligned with E2E tests).

---

## 2. Codebase Directory & Module Layout

```text
apps/api/src/modules/
├── finance/
│   ├── finance.module.ts
│   ├── controllers/
│   │   ├── income-sources.controller.ts
│   │   ├── income-categories.controller.ts
│   │   ├── expense-categories.controller.ts
│   │   ├── incomes.controller.ts
│   │   └── expenses.controller.ts
│   └── services/
│       ├── income-sources.service.ts
│       ├── categories.service.ts
│       ├── incomes.service.ts
│       └── expenses.service.ts
├── inventory/
│   ├── inventory.module.ts
│   ├── controllers/
│   │   ├── items.controller.ts
│   │   └── stock-adjustments.controller.ts
│   └── services/
│       ├── items.service.ts
│       └── stock.service.ts
├── purchases/
│   ├── purchases.module.ts
│   ├── controllers/
│   │   └── purchases.controller.ts
│   └── services/
│       ├── purchases.service.ts
│       └── purchase-completion.service.ts
├── debts/
│   ├── debts.module.ts
│   ├── controllers/
│   │   └── debts.controller.ts
│   └── services/
│       └── debts.service.ts
├── reports/
│   ├── reports.module.ts
│   ├── controllers/
│   │   ├── dashboard.controller.ts
│   │   └── reports.controller.ts
│   └── services/
│       ├── dashboard.service.ts
│       ├── reports.service.ts
│       └── csv-export.service.ts
└── notifications/
    ├── notifications.module.ts
    ├── controllers/
    │   └── notification-preferences.controller.ts
    └── services/
        ├── notification-preferences.service.ts
        └── stock-notification-outbox.service.ts
```

---

## 3. Module 1: Finance Module

### 3.1 Income Sources (`/api/v1/income-sources`)
Master data for revenue origins (e.g. "Gaji Kantor", "Freelance", "Hasil Toko Online").

#### Database Table: `income_sources`
- Columns: `id` (UUID PK), `household_id` (UUID FK), `name` (varchar 100), `description` (text), `is_active` (boolean, default true), `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- Unique Index: `(household_id, name) WHERE deleted_at IS NULL`.

#### Endpoints
| Verb | Path | Description | Expected Status | Validation Schema |
|------|------|-------------|-----------------|-------------------|
| `POST` | `/api/v1/income-sources` | Create new income source | `201 Created` | `createIncomeSourceSchema` |
| `GET` | `/api/v1/income-sources` | List income sources | `200 OK` | `incomeSourceQuerySchema` (`includeInactive`) |
| `GET` | `/api/v1/income-sources/:id` | Get single income source | `200 OK` | UUID param |
| `PUT` | `/api/v1/income-sources/:id` | Update income source | `200 OK` | `updateIncomeSourceSchema` |
| `DELETE` | `/api/v1/income-sources/:id` | Soft delete source | `200 OK` / `204 No Content` | UUID param |

#### Business Logic & Rules
1. **Uniqueness**: If an active source with the same name exists in the household, return `422 Unprocessable Entity` ("Nama sumber pendapatan sudah digunakan").
2. **Querying**: By default, returns sources where `deleted_at IS NULL` and (`is_active = true` OR `includeInactive = true`).
3. **Soft Delete**: `UPDATE income_sources SET deleted_at = NOW(), updated_by = :userId WHERE id = :id AND household_id = :householdId`. Incomes already referencing this source remain intact via foreign key `onDelete: 'restrict'`.

---

### 3.2 Income Categories (`/api/v1/income-categories`)
Classification for incomes (e.g. "Gaji Pokok", "Investasi", "Bonus").

#### Database Table: `income_categories`
- Columns: `id` (UUID PK), `household_id` (UUID FK), `name` (varchar 100), `icon` (varchar 50), `color` (varchar 20), `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.
- Unique Index: `(household_id, name) WHERE deleted_at IS NULL`.

#### Endpoints
- `POST /api/v1/income-categories` (`createIncomeCategorySchema`): Returns `201 Created`.
- `GET /api/v1/income-categories`: Returns all categories where `deleted_at IS NULL`.
- `GET /api/v1/income-categories/:id`: Returns category or `404 Not Found`.
- `PUT /api/v1/income-categories/:id` (`updateIncomeCategorySchema`): Updates `name`, `icon`, `color`.
- `DELETE /api/v1/income-categories/:id`: Soft delete (`deleted_at = NOW()`).

---

### 3.3 Expense Categories (`/api/v1/expense-categories`)
Classification for expenses and purchases with optional IDR monthly budget limits.

#### Database Table: `expense_categories`
- Columns: `id` (UUID PK), `household_id` (UUID FK), `name` (varchar 100), `icon` (varchar 50), `color` (varchar 20), `budget_limit` (numeric 14,0 optional), `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`.

#### Endpoints
- `POST /api/v1/expense-categories` (`createExpenseCategorySchema`): Creates category with optional `budgetLimit`. Returns `201 Created`.
- `GET /api/v1/expense-categories`: Returns all where `deleted_at IS NULL`.
- `GET /api/v1/expense-categories/:id`: Returns single category or `404 Not Found`.
- `PUT /api/v1/expense-categories/:id` (`updateExpenseCategorySchema`): Updates name, icon, color, budgetLimit.
- `DELETE /api/v1/expense-categories/:id`: Soft delete (`deleted_at = NOW()`).

---

### 3.4 Incomes (`/api/v1/incomes`)
Direct revenue transaction logging.

#### Database Table: `incomes`
- Columns: `id` (UUID PK), `household_id` (UUID FK), `source_id` (UUID FK -> `income_sources`), `category_id` (UUID FK -> `income_categories` nullable), `date` (date string `YYYY-MM-DD`), `nominal` (numeric 14,0 > 0), `notes` (text), `created_at`, `updated_at`, `created_by` (UUID FK -> `users`), `updated_by`, `deleted_at`.
- Check Constraint: `nominal > 0`.

#### Endpoints
| Verb | Path | Description | Expected Status |
|------|------|-------------|-----------------|
| `POST` | `/api/v1/incomes` | Record new income | `201 Created` |
| `GET` | `/api/v1/incomes` | Paginated and filtered incomes list | `200 OK` |
| `GET` | `/api/v1/incomes/:id` | Get income detail with joined source & category | `200 OK` |
| `PUT` | `/api/v1/incomes/:id` | Update income | `200 OK` |
| `DELETE` | `/api/v1/incomes/:id` | Soft delete income | `200 OK` / `204 No Content` |

#### Business Rules & Validation
1. **Nominal Validation**:
   - `nominal <= 0`: Must reject with `422 Unprocessable Entity` (`{ success: false, message: 'Nominal harus lebih dari 0' }`).
   - `nominal > 999_999_999_999`: Reject with `422 Unprocessable Entity`.
2. **Mandatory Foreign Key**: `sourceId` must belong to the active household and not be deleted. If invalid, throw `422 Unprocessable Entity` ("Sumber pendapatan tidak valid").
3. **Filtering**:
   - `startDate` & `endDate` (`YYYY-MM-DD`): If provided, filter `date >= startDate AND date <= endDate`. If invalid date string format, return `400` or `422`.
   - `sourceId`, `categoryId`, `createdBy`.
   - `search`: Case-insensitive partial match on `notes`.
4. **Pagination**:
   - Accepts `page` (default 1) and `limit` (default 20, max 100).
   - Returns `{ success: true, data: Income[], meta: { page, limit, total, totalPages } }`.
5. **Eager Loading**: List and detail responses must include joined `source: { id, name }` and `category: { id, name, icon, color }`.

---

### 3.5 Expenses (`/api/v1/expenses`)
Direct expenditure transaction logging.

#### Database Table: `expenses`
- Columns: `id` (UUID PK), `household_id` (UUID FK), `category_id` (UUID FK -> `expense_categories`), `purchase_id` (UUID FK -> `purchases` nullable), `date` (date string `YYYY-MM-DD`), `nominal` (numeric 14,0 > 0), `payment_method` (`cash` | `transfer` | `ewallet` | `other`), `notes` (text), `created_at`, `updated_at`, `created_by` (UUID FK -> `users`), `updated_by`, `deleted_at`.
- Check Constraint: `nominal > 0`.

#### Endpoints
| Verb | Path | Description | Expected Status |
|------|------|-------------|-----------------|
| `POST` | `/api/v1/expenses` | Record new expense | `201 Created` |
| `GET` | `/api/v1/expenses` | Paginated and filtered expense list | `200 OK` |
| `GET` | `/api/v1/expenses/:id` | Get expense detail | `200 OK` |
| `PUT` | `/api/v1/expenses/:id` | Update expense | `200 OK` |
| `DELETE` | `/api/v1/expenses/:id` | Soft delete expense | `200 OK` / `204 No Content` |

#### Business Rules & Validation
1. **Mandatory Category**: `categoryId` is mandatory. Omission returns `422 Unprocessable Entity`.
2. **Nominal Validation**: `nominal <= 0` returns `422 Unprocessable Entity`.
3. **Payment Method**: Must be one of `['cash', 'transfer', 'ewallet', 'other']`. Default is `'cash'`.
4. **Filtering**: `startDate`, `endDate`, `categoryId`, `paymentMethod`, `purchaseId`, `createdBy`, `search`.

---

## 4. Module 2: Inventory Module

### 4.1 Items (`/api/v1/items`)
Inventory master catalogue tracking stock quantities and low stock thresholds.

#### Database Table: `items`
- Columns:
  - `id`: UUID PK
  - `household_id`: UUID FK -> `households`
  - `name`: varchar 150
  - `category`: varchar 100 (e.g. "Sembako", "Bumbu Dapur", "Pembersih")
  - `unit`: varchar 30 (e.g. "kg", "pcs", "liter", "sak", "botol", "pack")
  - `quantity_on_hand`: integer (default 0, check `>= 0`)
  - `low_stock_threshold`: integer (default 0, check `>= 0`)
  - `location`: varchar 100 (e.g. "Dapur", "Gudang Bawah")
  - `notes`: text
  - `is_active`: boolean (default true)
  - `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`

#### Dynamic Stock Status Calculation
The API dynamically derives and presents the stock status on all item query and response operations:
```typescript
export type StockStatusLabel = 'Aman' | 'Menipis' | 'Habis';

export function calculateStockStatus(quantity: number, threshold: number): StockStatusLabel {
  if (quantity <= 0) {
    return 'Habis';
  }
  if (quantity <= threshold) {
    return 'Menipis';
  }
  return 'Aman';
}
```
*Note*: The API response MUST serialize `status: 'Aman' | 'Menipis' | 'Habis'` to satisfy tests T1.19, T2.8, T2.9, and T3.5. Contract helper `calculateStockStatus()` mapping (`SAFE` -> `Aman`, `LOW` -> `Menipis`, `OUT` -> `Habis`) can also be stored or returned as a secondary attribute.

#### Initial Stock Creation Rule
When `POST /api/v1/items` is called with `quantityOnHand > 0`:
Within the creation transaction:
1. Insert `items` row with initial `quantityOnHand`.
2. Insert an initial audit movement into `stock_movements`:
   - `quantityDelta = quantityOnHand`
   - `resultingQuantity = quantityOnHand`
   - `reason = 'initial'`
   - `notes = 'Stok Awal'`
   - `createdBy = userId`

---

### 4.2 Stock Movements Audit Log
Every single change to an item's stock MUST create a row in `stock_movements`. Direct modification of `items.quantity_on_hand` without an audit log is strictly prohibited.

#### Database Table: `stock_movements`
- `id`: UUID PK
- `household_id`: UUID FK
- `item_id`: UUID FK -> `items`
- `quantity_delta`: integer (check `!= 0`)
- `resulting_quantity`: integer (check `>= 0`)
- `reason`: pgEnum `['purchase', 'manual_correction', 'waste', 'initial', 'reversal']`
- `notes`: text (stores user reason or reference description)
- `reference_id`: UUID nullable (links to `purchase_id` if reason is `purchase` or `reversal`)
- `created_at`: timestamp with timezone
- `created_by`: UUID FK -> `users`

---

### 4.3 Manual Stock Adjustments (`POST /api/v1/items/:id/stock-adjustments` & alias `/adjust`)

#### Endpoints Supported:
- `POST /api/v1/items/:id/stock-adjustments` (standard E2E contract)
- `POST /api/v1/items/:id/adjust` (alias endpoint for domain consistency)
- `GET /api/v1/items/:id/stock-adjustments` (audit log history for item)

#### Request Payload:
```json
{
  "delta": -2,
  "reason": "Digunakan untuk memasak katering keluarga"
}
```

#### Validation & Guard Rules:
1. **Mandatory Reason**: `reason` is required with min length 3. If omitted or empty, return `422 Unprocessable Entity` ("Alasan penyesuaian stok wajib diisi minimal 3 karakter").
2. **Delta Validation**: `delta == 0` returns `422 Unprocessable Entity` ("Delta perubahan stok tidak boleh 0").
3. **Non-Negative Invariant**: If `quantity_on_hand + delta < 0`, the transaction MUST abort and return `422 Unprocessable Entity` ("Stok tidak boleh bernilai negatif").

#### Transaction Execution Flow (`db.transaction`):
```typescript
async function adjustStock(householdId: string, itemId: string, userId: string, input: StockAdjustmentInput) {
  return await db.transaction(async (tx) => {
    // 1. Pessimistic lock row for update
    const [item] = await tx
      .select()
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.householdId, householdId), isNull(items.deletedAt)))
      .for('update');

    if (!item) {
      throw new NotFoundException('Barang tidak ditemukan');
    }

    const previousQuantity = item.quantityOnHand;
    const newQuantity = previousQuantity + input.delta;

    // 2. Validate non-negative stock invariant
    if (newQuantity < 0) {
      throw new UnprocessableEntityException('Stok tidak boleh bernilai negatif');
    }

    // 3. Update Item quantityOnHand
    await tx
      .update(items)
      .set({
        quantityOnHand: newQuantity,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(items.id, itemId));

    // 4. Insert stock_movements entry
    const reasonType = input.delta < 0 ? 'waste' : 'manual_correction';
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        householdId,
        itemId,
        quantityDelta: input.delta,
        resultingQuantity: newQuantity,
        reason: reasonType,
        notes: input.reason,
        createdBy: userId,
      })
      .returning();

    // 5. Evaluate Stock Threshold Transition for Outbox Notifications
    const transition = evaluateStockThresholdTransition(previousQuantity, newQuantity, item.lowStockThreshold);
    if (transition.shouldNotify && transition.eventType) {
      await outboxService.enqueueStockEvent(tx, {
        householdId,
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        currentStock: newQuantity,
        threshold: item.lowStockThreshold,
        eventType: transition.eventType,
      });
    }

    const statusLabel = calculateStockStatus(newQuantity, item.lowStockThreshold);

    return {
      itemId,
      previousQuantity,
      delta: input.delta,
      newQuantity,
      status: statusLabel,
      movementId: movement.id,
    };
  });
}
```

---

## 5. Module 3: Purchases Module & Atomic Completion

The Purchases module coordinates procurement, automated expense generation, item stock replenishment, and idempotency protection in a single atomic database transaction.

### 5.1 Database Schema: `purchases` & `purchase_items`
- `purchases`:
  - `id`: UUID PK
  - `household_id`: UUID FK -> `households`
  - `expense_category_id`: UUID FK -> `expense_categories`
  - `date`: date (`YYYY-MM-DD`)
  - `total_amount`: numeric(14,0) (server-calculated sum of subtotal)
  - `vendor`: varchar 150
  - `payment_method`: enum (`cash`, `transfer`, `ewallet`, `other`)
  - `status`: enum (`draft`, `completed`, `cancelled`) default `'draft'`
  - `idempotency_key`: varchar 100 unique nullable
  - `notes`: text
  - `completed_at`: timestamp with timezone nullable
  - `created_at`, `updated_at`, `created_by`, `updated_by`
- `purchase_items`:
  - `id`: UUID PK
  - `purchase_id`: UUID FK -> `purchases` (cascade delete on draft removal)
  - `item_id`: UUID FK -> `items` nullable (allows non-inventory items like packaging)
  - `item_name`: varchar 150
  - `quantity`: integer (> 0)
  - `unit_price`: numeric(14,0) (>= 0)
  - `subtotal`: numeric(14,0) (= quantity * unit_price)

---

### 5.2 Purchase Draft Creation (`POST /api/v1/purchases`)
- Validates with `createPurchaseSchema`:
  - `items`: array with min 1 row.
  - Server calculates `subtotal = item.quantity * item.unitPrice` for each line item.
  - Server calculates `totalAmount = sum(items.map(i => i.subtotal))`.
- Inserts `purchases` with status `'draft'` and line items in `purchase_items`.
- Returns `201 Created` with full purchase and items payload.

---

### 5.3 Atomic Purchase Completion (`POST /api/v1/purchases/:id/complete`)

#### Requirements:
1. **Idempotency Key Handling**:
   - Accepts idempotency key from header `Idempotency-Key` or body property `idempotencyKey`.
   - If purchase is already in `'completed'` state:
     - If provided key matches `purchase.idempotency_key`: Return `200 OK` with existing completed result (Safe Idempotent Replay, Test T3.2).
     - If no key provided or key differs: Throw `400 Bad Request` ("Purchase has already been completed", Test T3.3).
   - If purchase is `'cancelled'`: Throw `400 Bad Request` ("Cannot complete a cancelled purchase").

#### Complete Transaction Execution Algorithm (`db.transaction`):
```typescript
async function completePurchase(
  householdId: string,
  purchaseId: string,
  userId: string,
  idempotencyKey?: string
) {
  return await db.transaction(async (tx) => {
    // 1. Lock purchase row FOR UPDATE
    const [purchase] = await tx
      .select()
      .from(purchases)
      .where(and(eq(purchases.id, purchaseId), eq(purchases.householdId, householdId)))
      .for('update');

    if (!purchase) {
      throw new NotFoundException('Data pembelian tidak ditemukan');
    }

    // 2. Check Idempotency and State
    if (purchase.status === 'completed') {
      if (idempotencyKey && purchase.idempotencyKey === idempotencyKey) {
        // Find existing linked expense
        const [existingExpense] = await tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.purchaseId, purchaseId), eq(expenses.householdId, householdId)));

        return {
          id: purchase.id,
          status: 'completed',
          totalAmount: Number(purchase.totalAmount),
          expenseId: existingExpense?.id,
          completedAt: purchase.completedAt,
        };
      }
      throw new BadRequestException('Pembelian ini sudah selesai diproses');
    }

    if (purchase.status === 'cancelled') {
      throw new BadRequestException('Tidak dapat menyelesaikan pembelian yang sudah dibatalkan');
    }

    // 3. Update Purchase status to completed
    const now = new Date();
    await tx
      .update(purchases)
      .set({
        status: 'completed',
        completedAt: now,
        idempotencyKey: idempotencyKey || null,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(eq(purchases.id, purchaseId));

    // 4. Create Linked Expense Record in `expenses`
    const [newExpense] = await tx
      .insert(expenses)
      .values({
        householdId,
        categoryId: purchase.expenseCategoryId,
        purchaseId: purchase.id,
        date: purchase.date,
        nominal: purchase.totalAmount,
        paymentMethod: purchase.paymentMethod,
        notes: purchase.notes ? `Pembelian: ${purchase.notes}` : `Pembelian #${purchase.id}`,
        createdBy: userId,
      })
      .returning();

    // 5. Fetch all purchase_items
    const lines = await tx
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseId, purchaseId));

    // 6. Process Stock Increments for items linked to inventory
    for (const line of lines) {
      if (!line.itemId) {
        // Non-inventory item (e.g. plastic bag / packaging), skip stock update
        continue;
      }

      // Lock item row FOR UPDATE
      const [item] = await tx
        .select()
        .from(items)
        .where(and(eq(items.id, line.itemId), eq(items.householdId, householdId), isNull(items.deletedAt)))
        .for('update');

      if (!item) {
        throw new NotFoundException(`Barang inventori dengan ID ${line.itemId} tidak ditemukan`);
      }

      const previousQty = item.quantityOnHand;
      const newQty = previousQty + line.quantity;

      // Update item stock
      await tx
        .update(items)
        .set({
          quantityOnHand: newQty,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(items.id, item.id));

      // Insert stock movement record
      await tx.insert(stockMovements).values({
        householdId,
        itemId: item.id,
        quantityDelta: line.quantity, // Positive delta
        resultingQuantity: newQty,
        reason: 'purchase',
        referenceId: purchase.id,
        notes: `Pembelian #${purchase.id} (${line.itemName})`,
        createdBy: userId,
      });

      // Threshold transition check
      const transition = evaluateStockThresholdTransition(previousQty, newQty, item.lowStockThreshold);
      if (transition.shouldNotify && transition.eventType) {
        await outboxService.enqueueStockEvent(tx, {
          householdId,
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          currentStock: newQty,
          threshold: item.lowStockThreshold,
          eventType: transition.eventType,
        });
      }
    }

    return {
      id: purchase.id,
      status: 'completed',
      totalAmount: Number(purchase.totalAmount),
      expenseId: newExpense.id,
      completedAt: now,
    };
  });
}
```

---

### 5.4 Cancel Purchase Draft (`POST /api/v1/purchases/:id/cancel`)
- Input: `{ reason: string }` (`cancelPurchaseSchema`, min length 3).
- Must verify `status === 'draft'`. If already completed or cancelled, return `400 Bad Request`.
- Transitions `status = 'cancelled'`, appends reason to `notes`, sets `updated_at` and `updated_by`.

---

## 6. Module 4: Debts & Receivables Module

Tracks household liabilities (`payable`) and assets owed to the household (`receivable`).

### 6.1 Database Schema: `debts_receivables` & `debt_receivable_payments`
- `debts_receivables`:
  - `id`: UUID PK
  - `household_id`: UUID FK -> `households`
  - `type`: pgEnum `['payable', 'receivable']`
  - `party_name`: varchar 150
  - `description`: text
  - `principal_amount`: numeric(14,0) (> 0)
  - `remaining_balance`: numeric(14,0) (>= 0)
  - `due_date`: date nullable (`YYYY-MM-DD`)
  - `status`: pgEnum `['open', 'partially_paid', 'settled', 'overdue', 'cancelled']`
  - `notes`: text
  - `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`
- `debt_receivable_payments`:
  - `id`: UUID PK
  - `debt_receivable_id`: UUID FK -> `debts_receivables`
  - `amount`: numeric(14,0) (> 0)
  - `payment_date`: date (`YYYY-MM-DD`)
  - `payment_method`: pgEnum (`cash`, `transfer`, `ewallet`, `other`)
  - `notes`: text
  - `created_at`: timestamp with timezone
  - `created_by`: UUID FK -> `users`

---

### 6.2 Debts & Receivables CRUD
1. **Creation (`POST /api/v1/debts-receivables`)**:
   - Input: `type`, `partyName`, `description`, `principalAmount`, `dueDate`, `notes`.
   - Rule: Sets `remaining_balance = principalAmount`, `status = 'open'`. Returns `201 Created`.
2. **List (`GET /api/v1/debts-receivables`)**:
   - Query filters: `type: 'payable' | 'receivable'`, `status`, `search`, pagination.
   - Dynamic Overdue Evaluation: For any returned record where `status NOT IN ('settled', 'cancelled')` AND `dueDate < today()`, the serialized `status` MUST evaluate to `'overdue'` (Test T2.13).
3. **Detail (`GET /api/v1/debts-receivables/:id`)**:
   - Returns debt detail with nested `payments: DebtPayment[]` list and evaluated status.

---

### 6.3 Repayment Endpoint (`POST /api/v1/debts-receivables/:id/payments`)

#### Request Payload:
```json
{
  "paymentDate": "2026-10-27",
  "amount": 300000,
  "paymentMethod": "transfer",
  "notes": "Cicilan pertama"
}
```

#### Validation & Guard Rules:
1. `amount <= 0`: Reject with `422 Unprocessable Entity` ("Nominal pembayaran harus lebih dari 0", Test T2.11).
2. If `debt.status === 'settled'`: Reject with `422 Unprocessable Entity` ("Hutang/piutang ini sudah lunas").
3. **Overpayment Guard**: If `amount > debt.remaining_balance`:
   - MUST reject with `422 Unprocessable Entity` ("Jumlah pembayaran melebihi sisa saldo", Test T2.10).

#### Repayment Transaction (`db.transaction`):
```typescript
async function recordPayment(
  householdId: string,
  debtId: string,
  userId: string,
  input: RecordPaymentInput
) {
  return await db.transaction(async (tx) => {
    // 1. Lock debt row FOR UPDATE
    const [debt] = await tx
      .select()
      .from(debtsReceivables)
      .where(
        and(
          eq(debtsReceivables.id, debtId),
          eq(debtsReceivables.householdId, householdId),
          isNull(debtsReceivables.deletedAt)
        )
      )
      .for('update');

    if (!debt) {
      throw new NotFoundException('Data hutang/piutang tidak ditemukan');
    }

    const currentBalance = Number(debt.remainingBalance);

    if (currentBalance <= 0 || debt.status === 'settled') {
      throw new UnprocessableEntityException('Hutang/piutang ini sudah lunas');
    }

    // 2. Validate amount against remaining balance
    if (input.amount > currentBalance) {
      throw new UnprocessableEntityException('Jumlah pembayaran melebihi sisa saldo');
    }

    const newBalance = currentBalance - input.amount;
    const newStatus = newBalance === 0 ? 'settled' : 'partially_paid';
    const now = new Date();

    // 3. Record payment entry
    const [payment] = await tx
      .insert(debtReceivablePayments)
      .values({
        debtReceivableId: debt.id,
        amount: String(input.amount),
        paymentDate: input.paymentDate,
        paymentMethod: input.paymentMethod || 'transfer',
        notes: input.notes,
        createdBy: userId,
      })
      .returning();

    // 4. Update debt remaining_balance and status
    await tx
      .update(debtsReceivables)
      .set({
        remainingBalance: String(newBalance),
        status: newStatus,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(eq(debtsReceivables.id, debt.id));

    return {
      id: payment.id,
      debtReceivableId: debt.id,
      amount: input.amount,
      remainingBalance: newBalance,
      status: newStatus,
      paymentDate: input.paymentDate,
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
    };
  });
}
```

---

## 7. Module 5: Dashboard & Reports Module

### 7.1 Dashboard Aggregations (`GET /api/v1/dashboard` & `/api/v1/dashboard/summary`)

#### Query Parameters:
- `period`: `'this_month' | 'last_month' | 'this_year' | 'custom' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM'` (default `this_month`).
- `startDate`: `YYYY-MM-DD` optional.
- `endDate`: `YYYY-MM-DD` optional.

#### Date Range Resolution (Asia/Jakarta Timezone):
- `this_month`: 1st day of current month to last day of current month.
- `last_month`: 1st day to last day of previous month.
- `this_year`: Jan 1 to Dec 31 of current year.
- `custom`: exact `startDate` to `endDate`.

#### Aggregation Queries:
1. `totalIncome`:
   ```sql
   SELECT COALESCE(SUM(nominal), 0)::numeric AS total
   FROM incomes
   WHERE household_id = :householdId
     AND date >= :startDate AND date <= :endDate
     AND deleted_at IS NULL;
   ```
2. `totalExpense`:
   ```sql
   SELECT COALESCE(SUM(nominal), 0)::numeric AS total
   FROM expenses
   WHERE household_id = :householdId
     AND date >= :startDate AND date <= :endDate
     AND deleted_at IS NULL;
   ```
3. `netCashFlow`: `totalIncome - totalExpense`.
4. `openDebtsTotal`: Sum of `remaining_balance` where `type = 'payable'` and `status IN ('open', 'partially_paid', 'overdue')` and `deleted_at IS NULL`.
5. `openReceivablesTotal`: Sum of `remaining_balance` where `type = 'receivable'` and `status IN ('open', 'partially_paid', 'overdue')` and `deleted_at IS NULL`.
6. `lowStockItems`:
   Query all items in household where `quantity_on_hand <= low_stock_threshold` and `deleted_at IS NULL`:
   Each returned item contains:
   ```json
   {
     "id": "uuid",
     "name": "Beras Rojolele",
     "unit": "kg",
     "quantityOnHand": 2,
     "currentStock": 2,
     "lowStockThreshold": 5,
     "threshold": 5,
     "status": "Menipis"
   }
   ```
   *(Providing both `quantityOnHand` and `currentStock`, as well as `lowStockThreshold` and `threshold`, satisfies both E2E tests and UI contracts).*
7. `recentTransactions`:
   Combined union of last 10 transactions (Incomes + Expenses) ordered by `date DESC, created_at DESC`.
   ```json
   {
     "id": "uuid",
     "type": "expense",
     "date": "2026-10-27",
     "nominal": 185000,
     "categoryOrSource": "Tagihan Listrik",
     "notes": "Listrik PLN",
     "recordedByName": "Budi Santoso"
   }
   ```
8. **Response Envelope Structure** (Satisfies Test T1.25):
   ```json
   {
     "success": true,
     "data": {
       "period": "this_month",
       "startDate": "2026-10-01",
       "endDate": "2026-10-31",
       "summaryCards": {
         "totalIncome": 15000000,
         "totalExpense": 1100000,
         "netCashFlow": 13900000,
         "openDebtsTotal": 4000000,
         "openReceivablesTotal": 500000
       },
       "totalIncome": 15000000,
       "totalExpense": 1100000,
       "netCashFlow": 13900000,
       "lowStockCount": 1,
       "outOfStockCount": 0,
       "lowStockItems": [...],
       "recentTransactions": [...]
     }
   }
   ```

---

### 7.2 Monthly Report (`GET /api/v1/reports/monthly`)
- Query: `year` (int), `month` (int 1-12).
- Returns:
  1. `totalIncome`, `totalExpense`, `netCashFlow`.
  2. `expenseByCategory`:
     - Group expenses by `categoryId` joining `expense_categories`.
     - Fields: `categoryId`, `categoryName`, `color`, `nominal`, `percentage` (`nominal / totalExpense * 100`), `budgetLimit`, `budgetUtilizationPercentage`.
  3. `incomeBySource`:
     - Group incomes by `sourceId` joining `income_sources`.
     - Fields: `sourceId`, `sourceName`, `nominal`, `percentage`.
  4. `dailyTrend`:
     - Continuous array for every day of the month (Day 1 through Last Day):
     - `[{ date: '2026-10-01', income: 15000000, expense: 750000 }, ...]`.
     - Days without transactions output `income: 0, expense: 0`.

---

### 7.3 Yearly Report (`GET /api/v1/reports/yearly`)
- Query: `year` (int).
- Requirements (Test T1.27 & T2.18):
  - Must return an array `monthlyTrends` with **EXACTLY 12 calendar months**.
  - **Zero-Continuity Guarantee**: For future or inactive years with 0 transactions, every single month must be present with `income: 0, expense: 0, net: 0`.
- Month Names in Indonesian:
  `['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']`.
- Output Structure:
  ```json
  {
    "success": true,
    "data": {
      "year": 2026,
      "totalIncome": 180000000,
      "totalExpense": 13200000,
      "netCashFlow": 166800000,
      "monthlyTrends": [
        { "month": 1, "monthName": "Januari", "income": 15000000, "expense": 1100000, "net": 13900000 },
        { "month": 2, "monthName": "Februari", "income": 15000000, "expense": 1100000, "net": 13900000 },
        ...
        { "month": 12, "monthName": "Desember", "income": 0, "expense": 0, "net": 0 }
      ]
    }
  }
  ```

---

### 7.4 Indonesian CSV Export (`GET /api/v1/reports/export/csv`)
- Query: `type: 'transactions' | 'incomes' | 'expenses'` (default `'transactions'`), `startDate`, `endDate`.
- Headers:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="laporan-${type}-${yearMonth}.csv"`
- Format & Locale:
  - Standard RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) prefix to guarantee seamless opening in Microsoft Excel on Windows/Mac in Indonesia.
  - Comma `,` separator (escaped fields enclosed in `""`).
  - Column Headers:
    - For `transactions`: `Tanggal,Tipe,Kategori / Sumber,Nominal (IDR),Metode Pembayaran,Catatan,Pencatat`
    - For `incomes`: `Tanggal,Sumber,Kategori,Nominal (IDR),Catatan,Pencatat`
    - For `expenses`: `Tanggal,Kategori,Nominal (IDR),Metode Pembayaran,No Pembelian,Catatan,Pencatat`
  - Row Content Example:
    ```csv
    Tanggal,Tipe,Kategori / Sumber,Nominal (IDR),Metode Pembayaran,Catatan,Pencatat
    2026-10-27,"Pemasukan","Gaji Pokok",15000000,"-","Gaji Bulanan PT Maju Bersama","Budi Santoso"
    2026-10-27,"Pengeluaran","Tagihan Rumah",750000,"Transfer Bank","Tagihan Listrik PLN & Air PAM","Budi Santoso"
    2026-10-27,"Pengeluaran","Belanja Sembako",350000,"E-Wallet","Belanja persediaan bulanan","Budi Santoso"
    ```

---

## 8. Module 6: Notification Preferences & Outbox Trigger

### 8.1 Notification Preferences Endpoints
- `GET /api/v1/settings/notifications` and alias `GET /api/v1/notifications/preferences`:
  - Returns notification settings for current user and household from `notification_preferences`.
  - Auto-initializes default preference if none exists (`emailEnabled: true`, `emailAddress: user.email`, `whatsappEnabled: false`).
- `PUT /api/v1/settings/notifications` and alias `PUT /api/v1/notifications/preferences`:
  - Validates with `updateNotificationPreferenceSchema`.
  - WhatsApp phone number regex: `/^\+62[0-9]{8,15}$/`.
  - Upserts record in `notification_preferences`.

---

### 8.2 Stock Threshold Outbox Event Generation

#### Trigger Condition:
Whenever item stock changes (via manual adjustment `POST /items/:id/stock-adjustments` or purchase completion `POST /purchases/:id/complete`):
Execute `evaluateStockThresholdTransition(previousQuantity, newQuantity, lowStockThreshold)`:
```typescript
export function evaluateStockThresholdTransition(
  previousQuantity: number,
  newQuantity: number,
  threshold: number
): StockThresholdEvaluation {
  // Case 1: Out of stock transition (had stock before, now 0 or less)
  if (previousQuantity > 0 && newQuantity <= 0) {
    return { shouldNotify: true, eventType: 'STOCK_OUT' };
  }

  // Case 2: Safe to Low stock transition (was above threshold, now at or below threshold but > 0)
  if (previousQuantity > threshold && newQuantity <= threshold && newQuantity > 0) {
    return { shouldNotify: true, eventType: 'STOCK_LOW' };
  }

  // Case 3: Already low or out, and further reduced: DO NOT NOTIFY (prevents alert spam, Test T3.6)
  // Case 4: Stock replenished back above threshold: DO NOT NOTIFY
  return { shouldNotify: false, eventType: null };
}
```

#### Outbox Insertion:
If `shouldNotify === true`:
Within the SAME transaction:
1. Query `notification_preferences` for members of the household where `email_enabled = true` or `whatsapp_enabled = true`.
2. For each active preference channel, insert a row into `notification_events`:
   - `household_id`: household.id
   - `item_id`: item.id
   - `event_type`: transition.eventType (`'STOCK_LOW'` | `'STOCK_OUT'`)
   - `channel`: `'EMAIL'` or `'WHATSAPP'`
   - `recipient`: preference.emailAddress or preference.whatsappNumber
   - `payload`:
     ```json
     {
       "itemId": "uuid",
       "itemName": "Beras Pandan Wangi",
       "unit": "sak",
       "currentStock": 1,
       "threshold": 2,
       "timestamp": "2026-10-27T14:35:00.000Z"
     }
     ```
   - `status`: `'PENDING'`
   - `attempts`: 0
   - `max_attempts`: 5

This guarantees zero duplicate notifications on further reductions (Test T3.6).

---

## 9. Error Envelopes, HTTP Status Codes & Exception Mapping

| Status Code | Reason / Condition | Envelope Payload Example |
|-------------|--------------------|--------------------------|
| `200 OK` | Successful retrieval, update, or action | `{ success: true, data: { ... } }` |
| `201 Created` | Successful entity creation | `{ success: true, data: { ... } }` |
| `204 No Content` | Soft deletion completed | None / empty body |
| `400 Bad Request` | Malformed parameters, illegal state transition (e.g. completing already completed purchase) | `{ success: false, statusCode: 400, error: "Bad Request", message: "Pembelian ini sudah selesai diproses" }` |
| `401 Unauthorized` | Missing / invalid JWT token | `{ success: false, statusCode: 401, error: "Unauthorized", message: "Unauthenticated" }` |
| `403 Forbidden` | Valid token, but wrong household | `{ success: false, statusCode: 403, error: "Forbidden", message: "Access to household denied" }` |
| `404 Not Found` | Entity not found or soft-deleted | `{ success: false, statusCode: 404, error: "Not Found", message: "Data tidak ditemukan" }` |
| `422 Unprocessable Entity` | Input validation failure (nominal <= 0, missing category, missing adjustment reason, overpaying debt, negative stock result) | `{ success: false, statusCode: 422, error: "Unprocessable Entity", message: "Nominal harus lebih dari 0", errors: [{ field: "nominal", message: "Nominal harus lebih dari 0" }] }` |
| `500 Internal Server Error` | Unexpected server crash (logs stack trace internally, returns generic message to client) | `{ success: false, statusCode: 500, error: "Internal Server Error", message: "Terjadi kesalahan internal pada server" }` |

---

## 10. E2E Test Verification Matrix

Every single test case in `tests/e2e/` maps directly to the domain specifications detailed above:

| E2E Test | Target Endpoint | Key Verification Invariant | Handled In Spec Section |
|----------|-----------------|----------------------------|-------------------------|
| **T1.8** | `CRUD /income-sources` | Create, list, update, soft-delete income source | §3.1 |
| **T1.9** | `CRUD /expense-categories` | Create, list, update with budgetLimit, soft-delete | §3.3 |
| **T1.10** | `CRUD /income-categories` | Create, list, soft-delete | §3.2 |
| **T1.11** | `POST /incomes` | Positive nominal validation, sourceId linkage | §3.4 |
| **T1.12** | `GET /incomes` | Pagination meta (`page`, `limit`, `total`) | §3.4 |
| **T1.13** | `GET /incomes?startDate=&endDate=` | Date range filtering | §3.4 |
| **T1.14** | `PUT & DELETE /incomes/:id` | Update nominal, soft delete | §3.4 |
| **T1.15** | `POST /expenses` | Mandatory categoryId and paymentMethod | §3.5 |
| **T1.16** | `GET /expenses?categoryId=` | Category filtering and pagination | §3.5 |
| **T1.17** | `PUT & DELETE /expenses/:id` | Update nominal, soft delete | §3.5 |
| **T1.18** | `POST /items` | Initial stock and low_stock_threshold | §4.1 |
| **T1.19** | `GET/POST /items` | Evaluates status to `Aman`, `Menipis`, `Habis` | §4.1 |
| **T1.20** | `POST /items/:id/stock-adjustments` | Delta update, audit log in `stock_movements` | §4.3 |
| **T1.21** | `POST /purchases` | Server calculates subtotal and totalAmount | §5.2 |
| **T1.22** | `POST /purchases/:id/cancel` | Status transitions to `cancelled` | §5.4 |
| **T1.23** | `POST /debts-receivables` | Remaining balance initialized to principal, status `open` | §6.2 |
| **T1.24** | `POST /debts-receivables/:id/payments` | Partial payment decrements remaining balance, status `partially_paid` | §6.3 |
| **T1.25** | `GET /dashboard?period=this_month` | `summaryCards`, `recentTransactions`, `lowStockItems` | §7.1 |
| **T1.26** | `GET /reports/monthly` | Category breakdowns, totalIncome, totalExpense | §7.2 |
| **T1.27** | `GET /reports/yearly` | Exactly 12 months with zero-month continuity | §7.3 |
| **T1.28** | `GET /reports/export/csv` | RFC 4180 CSV, `text/csv`, attachment header | §7.4 |
| **T2.1-T2.2** | `POST /incomes` | Nominal 0 or negative returns 422 | §3.4 |
| **T2.3-T2.4** | `POST /expenses` | Nominal <= 0 or missing category returns 422 | §3.5 |
| **T2.5** | `POST /incomes` | Max IDR boundary `999,999,999,999` handled safely | §3.4 |
| **T2.6** | `POST /items/:id/stock-adjustments` | Missing reason returns 422 | §4.3 |
| **T2.7** | `POST /items/:id/stock-adjustments` | Negative stock resulting returns 422 | §4.3 |
| **T2.8-T2.9** | `POST /items/:id/stock-adjustments` | Boundary transitions to `Habis` (0) and `Menipis` (<= threshold) | §4.3 |
| **T2.10-T2.11** | `POST /debts-receivables/:id/payments` | Overpaying balance or amount <= 0 returns 422 | §6.3 |
| **T2.12** | `POST /debts-receivables/:id/payments` | Exact balance payment transitions to `settled` | §6.3 |
| **T2.13** | `GET /debts-receivables/:id` | Past due date with remaining balance > 0 shows `overdue` | §6.2 |
| **T2.18** | `GET /reports/yearly` | Future inactive year maintains 12 months with 0 value | §7.3 |
| **T3.1** | `POST /purchases/:id/complete` | Creates expense + increments stock + logs movement atomically | §5.3 |
| **T3.2** | `POST /purchases/:id/complete` | Idempotent replay with same key returns 200 without duplicate action | §5.3 |
| **T3.3** | `POST /purchases/:id/complete` | Completing already completed purchase without matching key returns 400 | §5.3 |
| **T3.4** | Debt Payment Lifecycle | `open` -> `partially_paid` -> `settled` | §6.3 |
| **T3.5** | Stock Outbox Transition | Safe -> Menipis emits outbox event and appears in dashboard | §4.3, §8.2 |
| **T3.6** | Outbox Deduplication | Further reduction on already-low item suppresses duplicate notifications | §8.2 |
| **T3.7** | Cross-Household Guard | Cross-household read/update returns 403/404 | §1.1 |
| **T4.1** | Monthly Household Cycle | Full cycle integration (Income, Expense, Purchase, Stock, Debt, Reports, CSV) | §3-§7 |
| **T4.2** | Multi-Member Collaboration | Real-time shared budget and inventory access across household members | §1.1, §3-§7 |
