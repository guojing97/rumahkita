import {
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq, and, isNull, desc, sql, ilike } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';
import {
  CreateItemInput,
  UpdateItemInput,
  ItemQuery,
  StockAdjustmentInput,
  evaluateStockThresholdTransition,
} from '@rumahkita/contracts';

export type StockStatusLabel = 'Aman' | 'Menipis' | 'Habis';

export function calculateStockStatusLabel(quantity: number, threshold: number): StockStatusLabel {
  if (quantity <= 0) return 'Habis';
  if (quantity <= threshold) return 'Menipis';
  return 'Aman';
}

@Injectable()
export class InventoryService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async listItems(householdId: string, query: ItemQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.items.householdId, householdId),
      isNull(schema.items.deletedAt),
    ];

    if (query.category) {
      conditions.push(eq(schema.items.category, query.category));
    }
    if (query.search) {
      conditions.push(ilike(schema.items.name, `%${query.search}%`));
    }
    if (query.status && query.status !== 'all') {
      const qStatus = String(query.status).toUpperCase();
      if (qStatus === 'OUT' || qStatus === 'HABIS') {
        conditions.push(sql`${schema.items.quantityOnHand} <= 0`);
      } else if (qStatus === 'LOW' || qStatus === 'MENIPIS') {
        conditions.push(
          sql`${schema.items.quantityOnHand} > 0 AND ${schema.items.quantityOnHand} <= ${schema.items.lowStockThreshold}`
        );
      } else if (qStatus === 'SAFE' || qStatus === 'AMAN') {
        conditions.push(
          sql`${schema.items.quantityOnHand} > ${schema.items.lowStockThreshold}`
        );
      }
    }

    const whereClause = and(...conditions);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.items)
      .where(whereClause);

    const total = Number(countRow?.count || 0);

    const rows = await this.db
      .select()
      .from(schema.items)
      .where(whereClause)
      .orderBy(desc(schema.items.createdAt))
      .limit(limit)
      .offset(offset);

    const itemsWithStatus = rows.map((item) => {
      const status = calculateStockStatusLabel(
        item.quantityOnHand,
        item.lowStockThreshold
      );
      return {
        ...item,
        status,
        currentStock: item.quantityOnHand,
      };
    });

    return {
      data: itemsWithStatus,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getItemById(householdId: string, id: string) {
    const [item] = await this.db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.id, id),
          eq(schema.items.householdId, householdId),
          isNull(schema.items.deletedAt)
        )
      );

    if (!item) {
      throw new NotFoundException('Barang tidak ditemukan');
    }

    const status = calculateStockStatusLabel(
      item.quantityOnHand,
      item.lowStockThreshold
    );

    return {
      ...item,
      status,
      currentStock: item.quantityOnHand,
    };
  }

  async createItem(householdId: string, userId: string, input: CreateItemInput) {
    return await this.db.transaction(async (tx) => {
      const [item] = await tx
        .insert(schema.items)
        .values({
          householdId,
          name: input.name.trim(),
          category: input.category?.trim() || null,
          unit: input.unit.trim(),
          quantityOnHand: input.quantityOnHand ?? 0,
          lowStockThreshold: input.lowStockThreshold ?? 0,
          location: input.location?.trim() || null,
          notes: input.notes?.trim() || null,
          isActive: true,
          createdBy: userId,
        })
        .returning();

      // Log initial stock movement if initial stock > 0
      if (item.quantityOnHand > 0) {
        await tx.insert(schema.stockMovements).values({
          householdId,
          itemId: item.id,
          quantityDelta: item.quantityOnHand,
          resultingQuantity: item.quantityOnHand,
          reason: 'initial',
          notes: 'Stok Awal',
          createdBy: userId,
        });
      }

      const status = calculateStockStatusLabel(
        item.quantityOnHand,
        item.lowStockThreshold
      );

      return {
        ...item,
        status,
        currentStock: item.quantityOnHand,
      };
    });
  }

  async updateItem(householdId: string, id: string, userId: string, input: UpdateItemInput) {
    await this.getItemById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.category !== undefined) updateData.category = input.category?.trim() || null;
    if (input.unit !== undefined) updateData.unit = input.unit.trim();
    if (input.quantityOnHand !== undefined) updateData.quantityOnHand = input.quantityOnHand;
    if (input.lowStockThreshold !== undefined) updateData.lowStockThreshold = input.lowStockThreshold;
    if (input.location !== undefined) updateData.location = input.location?.trim() || null;
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [updated] = await this.db
      .update(schema.items)
      .set(updateData)
      .where(
        and(
          eq(schema.items.id, id),
          eq(schema.items.householdId, householdId)
        )
      )
      .returning();

    const status = calculateStockStatusLabel(
      updated.quantityOnHand,
      updated.lowStockThreshold
    );

    return {
      ...updated,
      status,
      currentStock: updated.quantityOnHand,
    };
  }

  async deleteItem(householdId: string, id: string, userId: string) {
    await this.getItemById(householdId, id);

    await this.db
      .update(schema.items)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.items.id, id),
          eq(schema.items.householdId, householdId)
        )
      );

    return null;
  }

  async adjustStock(
    householdId: string,
    itemId: string,
    userId: string,
    input: StockAdjustmentInput
  ) {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new UnprocessableEntityException('Alasan penyesuaian stok wajib diisi minimal 3 karakter');
    }
    if (input.delta === 0) {
      throw new UnprocessableEntityException('Delta perubahan stok tidak boleh 0');
    }

    return await this.db.transaction(async (tx) => {
      // 1. Pessimistic lock row FOR UPDATE
      const [item] = await tx
        .select()
        .from(schema.items)
        .where(
          and(
            eq(schema.items.id, itemId),
            eq(schema.items.householdId, householdId),
            isNull(schema.items.deletedAt)
          )
        )
        .for('update');

      if (!item) {
        throw new NotFoundException('Barang tidak ditemukan');
      }

      const previousQuantity = item.quantityOnHand;
      const newQuantity = previousQuantity + input.delta;

      // 2. Validate non-negative invariant
      if (newQuantity < 0) {
        throw new UnprocessableEntityException('Stok tidak boleh bernilai negatif');
      }

      // 3. Update Item stock
      await tx
        .update(schema.items)
        .set({
          quantityOnHand: newQuantity,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(schema.items.id, itemId));

      // 4. Insert stock movement record
      const reasonType = input.delta < 0 ? 'waste' : 'manual_correction';
      const [movement] = await tx
        .insert(schema.stockMovements)
        .values({
          householdId,
          itemId,
          quantityDelta: input.delta,
          resultingQuantity: newQuantity,
          reason: reasonType,
          notes: input.reason.trim(),
          createdBy: userId,
        })
        .returning();

      // 5. Evaluate Stock Threshold Transition
      const transition = evaluateStockThresholdTransition(
        previousQuantity,
        newQuantity,
        item.lowStockThreshold
      );

      if (transition.shouldNotify && transition.eventType) {
        // Query household notification preferences
        const preferences = await tx
          .select()
          .from(schema.notificationPreferences)
          .where(eq(schema.notificationPreferences.householdId, householdId));

        const activePrefs = preferences.filter(
          (p) => p.emailEnabled || p.whatsappEnabled
        );

        if (activePrefs.length > 0) {
          for (const pref of activePrefs) {
            if (pref.emailEnabled && pref.emailAddress) {
              await tx.insert(schema.notificationEvents).values({
                householdId,
                itemId: item.id,
                eventType: transition.eventType,
                channel: 'EMAIL',
                recipient: pref.emailAddress,
                payload: {
                  itemId: item.id,
                  itemName: item.name,
                  unit: item.unit,
                  currentStock: newQuantity,
                  threshold: item.lowStockThreshold,
                  timestamp: new Date().toISOString(),
                },
                status: 'PENDING',
              });
            }
            if (pref.whatsappEnabled && pref.whatsappNumber) {
              await tx.insert(schema.notificationEvents).values({
                householdId,
                itemId: item.id,
                eventType: transition.eventType,
                channel: 'WHATSAPP',
                recipient: pref.whatsappNumber,
                payload: {
                  itemId: item.id,
                  itemName: item.name,
                  unit: item.unit,
                  currentStock: newQuantity,
                  threshold: item.lowStockThreshold,
                  timestamp: new Date().toISOString(),
                },
                status: 'PENDING',
              });
            }
          }
        } else {
          // Default outbox event
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
              currentStock: newQuantity,
              threshold: item.lowStockThreshold,
              timestamp: new Date().toISOString(),
            },
            status: 'PENDING',
          });
        }
      }

      const status = calculateStockStatusLabel(newQuantity, item.lowStockThreshold);

      return {
        itemId,
        previousQuantity,
        delta: input.delta,
        newQuantity,
        status,
        movementId: movement.id,
      };
    });
  }

  async getStockAdjustments(householdId: string, itemId: string) {
    await this.getItemById(householdId, itemId);

    return await this.db
      .select()
      .from(schema.stockMovements)
      .where(
        and(
          eq(schema.stockMovements.itemId, itemId),
          eq(schema.stockMovements.householdId, householdId)
        )
      )
      .orderBy(desc(schema.stockMovements.createdAt));
  }
}
