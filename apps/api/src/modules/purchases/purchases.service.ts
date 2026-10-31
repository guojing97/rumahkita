import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';
import {
  CreatePurchaseInput,
  PurchaseQuery,
  CancelPurchaseInput,
  evaluateStockThresholdTransition,
} from '@rumahkita/contracts';

@Injectable()
export class PurchasesService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async listPurchases(householdId: string, query: PurchaseQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.purchases.householdId, householdId),
    ];

    if (query.status) {
      conditions.push(eq(schema.purchases.status, query.status));
    }
    if (query.startDate) {
      conditions.push(sql`${schema.purchases.date} >= ${query.startDate}`);
    }
    if (query.endDate) {
      conditions.push(sql`${schema.purchases.date} <= ${query.endDate}`);
    }

    const whereClause = and(...conditions);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.purchases)
      .where(whereClause);

    const total = Number(countRow?.count || 0);

    const rows = await this.db
      .select()
      .from(schema.purchases)
      .where(whereClause)
      .orderBy(desc(schema.purchases.date), desc(schema.purchases.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((p) => ({
      ...p,
      totalAmount: Number(p.totalAmount),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getPurchaseById(householdId: string, id: string) {
    const [purchase] = await this.db
      .select()
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.id, id),
          eq(schema.purchases.householdId, householdId)
        )
      );

    if (!purchase) {
      throw new NotFoundException('Data pembelian tidak ditemukan');
    }

    const items = await this.db
      .select()
      .from(schema.purchaseItems)
      .where(eq(schema.purchaseItems.purchaseId, id));

    return {
      ...purchase,
      totalAmount: Number(purchase.totalAmount),
      items: items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
    };
  }

  async createPurchase(householdId: string, userId: string, input: CreatePurchaseInput) {
    // 1. Verify expense category exists
    const [cat] = await this.db
      .select()
      .from(schema.expenseCategories)
      .where(
        and(
          eq(schema.expenseCategories.id, input.expenseCategoryId),
          eq(schema.expenseCategories.householdId, householdId),
          isNull(schema.expenseCategories.deletedAt)
        )
      );

    if (!cat) {
      throw new UnprocessableEntityException('Kategori pengeluaran tidak valid');
    }

    // 2. Compute lines and total
    let computedTotal = 0;
    const computedItems = input.items.map((item) => {
      const subtotal = item.quantity * item.unitPrice;
      computedTotal += subtotal;
      return {
        itemId: item.itemId || null,
        itemName: item.itemName.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
      };
    });

    return await this.db.transaction(async (tx) => {
      const [purchase] = await tx
        .insert(schema.purchases)
        .values({
          householdId,
          expenseCategoryId: input.expenseCategoryId,
          date: input.date,
          totalAmount: String(computedTotal),
          vendor: input.vendor?.trim() || null,
          paymentMethod: input.paymentMethod || 'cash',
          status: 'draft',
          notes: input.notes?.trim() || null,
          createdBy: userId,
        })
        .returning();

      const insertedItems = [];
      for (const item of computedItems) {
        const [pi] = await tx
          .insert(schema.purchaseItems)
          .values({
            purchaseId: purchase.id,
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: String(item.unitPrice),
            subtotal: String(item.subtotal),
          })
          .returning();
        insertedItems.push({
          ...pi,
          unitPrice: Number(pi.unitPrice),
          subtotal: Number(pi.subtotal),
        });
      }

      return {
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        items: insertedItems,
      };
    });
  }

  async completePurchase(
    householdId: string,
    purchaseId: string,
    userId: string,
    idempotencyKey?: string
  ) {
    return await this.db.transaction(async (tx) => {
      // 1. Lock purchase row FOR UPDATE
      const [purchase] = await tx
        .select()
        .from(schema.purchases)
        .where(
          and(
            eq(schema.purchases.id, purchaseId),
            eq(schema.purchases.householdId, householdId)
          )
        )
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
            .from(schema.expenses)
            .where(
              and(
                eq(schema.expenses.purchaseId, purchaseId),
                eq(schema.expenses.householdId, householdId)
              )
            );

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

      const now = new Date();

      // 3. Update Purchase status to completed
      await tx
        .update(schema.purchases)
        .set({
          status: 'completed',
          completedAt: now,
          idempotencyKey: idempotencyKey || null,
          updatedAt: now,
          updatedBy: userId,
        })
        .where(eq(schema.purchases.id, purchaseId));

      // 4. Create Linked Expense Record in `expenses`
      const [newExpense] = await tx
        .insert(schema.expenses)
        .values({
          householdId,
          categoryId: purchase.expenseCategoryId,
          purchaseId: purchase.id,
          date: purchase.date,
          nominal: purchase.totalAmount,
          paymentMethod: purchase.paymentMethod,
          notes: purchase.notes
            ? `Pembelian: ${purchase.notes}`
            : `Pembelian dari ${purchase.vendor || 'Vendor'}`,
          createdBy: userId,
        })
        .returning();

      // 5. Fetch all purchase_items
      const lines = await tx
        .select()
        .from(schema.purchaseItems)
        .where(eq(schema.purchaseItems.purchaseId, purchaseId));

      // 6. Process Stock Increments for items linked to inventory
      for (const line of lines) {
        if (!line.itemId) {
          // Non-inventory item, skip stock update
          continue;
        }

        // Lock item row FOR UPDATE
        const [item] = await tx
          .select()
          .from(schema.items)
          .where(
            and(
              eq(schema.items.id, line.itemId),
              eq(schema.items.householdId, householdId),
              isNull(schema.items.deletedAt)
            )
          )
          .for('update');

        if (!item) {
          throw new NotFoundException(
            `Barang inventori dengan ID ${line.itemId} tidak ditemukan`
          );
        }

        const previousQty = item.quantityOnHand;
        const newQty = previousQty + line.quantity;

        // Update item stock
        await tx
          .update(schema.items)
          .set({
            quantityOnHand: newQty,
            updatedAt: now,
            updatedBy: userId,
          })
          .where(eq(schema.items.id, item.id));

        // Insert stock movement record
        await tx.insert(schema.stockMovements).values({
          householdId,
          itemId: item.id,
          quantityDelta: line.quantity,
          resultingQuantity: newQty,
          reason: 'purchase',
          referenceId: purchase.id,
          notes: `Pembelian #${purchase.id} (${line.itemName})`,
          createdBy: userId,
        });

        // Threshold transition check
        const transition = evaluateStockThresholdTransition(
          previousQty,
          newQty,
          item.lowStockThreshold
        );

        if (transition.shouldNotify && transition.eventType) {
          await tx.insert(schema.notificationEvents).values({
            householdId,
            itemId: item.id,
            eventType: transition.eventType,
            channel: 'EMAIL',
            recipient: 'household@rumahkita.local',
            payload: {
              itemId: item.id,
              itemName: item.name,
              unit: item.unit,
              currentStock: newQty,
              threshold: item.lowStockThreshold,
              timestamp: now.toISOString(),
            },
            status: 'PENDING',
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

  async cancelPurchase(householdId: string, purchaseId: string, userId: string, input: CancelPurchaseInput) {
    const [purchase] = await this.db
      .select()
      .from(schema.purchases)
      .where(
        and(
          eq(schema.purchases.id, purchaseId),
          eq(schema.purchases.householdId, householdId)
        )
      );

    if (!purchase) {
      throw new NotFoundException('Data pembelian tidak ditemukan');
    }

    if (purchase.status !== 'draft') {
      throw new BadRequestException('Hanya draf pembelian yang dapat dibatalkan');
    }

    const updatedNotes = purchase.notes
      ? `${purchase.notes} (Dibatalkan: ${input.reason})`
      : `Dibatalkan: ${input.reason}`;

    const [cancelled] = await this.db
      .update(schema.purchases)
      .set({
        status: 'cancelled',
        notes: updatedNotes,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(schema.purchases.id, purchaseId))
      .returning();

    return {
      ...cancelled,
      totalAmount: Number(cancelled.totalAmount),
    };
  }
}
