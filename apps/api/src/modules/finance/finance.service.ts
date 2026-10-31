import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq, and, or, isNull, desc, gte, lte, sql, ilike } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';
import {
  CreateIncomeSourceInput,
  UpdateIncomeSourceInput,
  CreateIncomeCategoryInput,
  UpdateIncomeCategoryInput,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CreateIncomeInput,
  UpdateIncomeInput,
  IncomeQuery,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseQuery,
  TransactionQuery,
} from '@rumahkita/contracts';

@Injectable()
export class FinanceService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  // ---------------------------------------------------------------------------
  // Income Sources
  // ---------------------------------------------------------------------------

  async listIncomeSources(householdId: string, includeInactive = false) {
    const conditions = [
      eq(schema.incomeSources.householdId, householdId),
      isNull(schema.incomeSources.deletedAt),
    ];

    if (!includeInactive) {
      conditions.push(eq(schema.incomeSources.isActive, true));
    }

    return await this.db
      .select()
      .from(schema.incomeSources)
      .where(and(...conditions))
      .orderBy(desc(schema.incomeSources.createdAt));
  }

  async getIncomeSourceById(householdId: string, id: string) {
    const [source] = await this.db
      .select()
      .from(schema.incomeSources)
      .where(
        and(
          eq(schema.incomeSources.id, id),
          eq(schema.incomeSources.householdId, householdId),
          isNull(schema.incomeSources.deletedAt)
        )
      );

    if (!source) {
      throw new NotFoundException('Sumber pendapatan tidak ditemukan');
    }

    return source;
  }

  async createIncomeSource(householdId: string, userId: string, input: CreateIncomeSourceInput) {
    const trimmedName = input.name.trim();

    // Check duplicate active name
    const [existing] = await this.db
      .select()
      .from(schema.incomeSources)
      .where(
        and(
          eq(schema.incomeSources.householdId, householdId),
          eq(schema.incomeSources.name, trimmedName),
          isNull(schema.incomeSources.deletedAt)
        )
      );

    if (existing) {
      throw new ConflictException('Nama sumber pendapatan sudah digunakan');
    }

    const [source] = await this.db
      .insert(schema.incomeSources)
      .values({
        householdId,
        name: trimmedName,
        description: input.description?.trim() || null,
        isActive: true,
        createdBy: userId,
      })
      .returning();

    return source;
  }

  async updateIncomeSource(
    householdId: string,
    id: string,
    userId: string,
    input: UpdateIncomeSourceInput
  ) {
    await this.getIncomeSourceById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.name !== undefined) {
      updateData.name = input.name.trim();
    }
    if (input.description !== undefined) {
      updateData.description = input.description?.trim() || null;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    const [updated] = await this.db
      .update(schema.incomeSources)
      .set(updateData)
      .where(
        and(
          eq(schema.incomeSources.id, id),
          eq(schema.incomeSources.householdId, householdId)
        )
      )
      .returning();

    return updated;
  }

  async deleteIncomeSource(householdId: string, id: string, userId: string) {
    await this.getIncomeSourceById(householdId, id);

    await this.db
      .update(schema.incomeSources)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.incomeSources.id, id),
          eq(schema.incomeSources.householdId, householdId)
        )
      );

    return null;
  }

  // ---------------------------------------------------------------------------
  // Income Categories
  // ---------------------------------------------------------------------------

  async listIncomeCategories(householdId: string) {
    return await this.db
      .select()
      .from(schema.incomeCategories)
      .where(
        and(
          eq(schema.incomeCategories.householdId, householdId),
          isNull(schema.incomeCategories.deletedAt)
        )
      )
      .orderBy(desc(schema.incomeCategories.createdAt));
  }

  async getIncomeCategoryById(householdId: string, id: string) {
    const [cat] = await this.db
      .select()
      .from(schema.incomeCategories)
      .where(
        and(
          eq(schema.incomeCategories.id, id),
          eq(schema.incomeCategories.householdId, householdId),
          isNull(schema.incomeCategories.deletedAt)
        )
      );

    if (!cat) {
      throw new NotFoundException('Kategori pemasukan tidak ditemukan');
    }

    return cat;
  }

  async createIncomeCategory(householdId: string, userId: string, input: CreateIncomeCategoryInput) {
    const [cat] = await this.db
      .insert(schema.incomeCategories)
      .values({
        householdId,
        name: input.name.trim(),
        icon: input.icon?.trim() || null,
        color: input.color?.trim() || null,
        createdBy: userId,
      })
      .returning();

    return cat;
  }

  async updateIncomeCategory(
    householdId: string,
    id: string,
    userId: string,
    input: UpdateIncomeCategoryInput
  ) {
    await this.getIncomeCategoryById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.icon !== undefined) updateData.icon = input.icon?.trim() || null;
    if (input.color !== undefined) updateData.color = input.color?.trim() || null;

    const [updated] = await this.db
      .update(schema.incomeCategories)
      .set(updateData)
      .where(
        and(
          eq(schema.incomeCategories.id, id),
          eq(schema.incomeCategories.householdId, householdId)
        )
      )
      .returning();

    return updated;
  }

  async deleteIncomeCategory(householdId: string, id: string, userId: string) {
    await this.getIncomeCategoryById(householdId, id);

    await this.db
      .update(schema.incomeCategories)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.incomeCategories.id, id),
          eq(schema.incomeCategories.householdId, householdId)
        )
      );

    return null;
  }

  // ---------------------------------------------------------------------------
  // Expense Categories
  // ---------------------------------------------------------------------------

  async listExpenseCategories(householdId: string) {
    const rows = await this.db
      .select()
      .from(schema.expenseCategories)
      .where(
        and(
          eq(schema.expenseCategories.householdId, householdId),
          isNull(schema.expenseCategories.deletedAt)
        )
      )
      .orderBy(desc(schema.expenseCategories.createdAt));

    return rows.map((r) => ({
      ...r,
      budgetLimit: r.budgetLimit ? Number(r.budgetLimit) : null,
    }));
  }

  async getExpenseCategoryById(householdId: string, id: string) {
    const [cat] = await this.db
      .select()
      .from(schema.expenseCategories)
      .where(
        and(
          eq(schema.expenseCategories.id, id),
          eq(schema.expenseCategories.householdId, householdId),
          isNull(schema.expenseCategories.deletedAt)
        )
      );

    if (!cat) {
      throw new NotFoundException('Kategori pengeluaran tidak ditemukan');
    }

    return {
      ...cat,
      budgetLimit: cat.budgetLimit ? Number(cat.budgetLimit) : null,
    };
  }

  async createExpenseCategory(householdId: string, userId: string, input: CreateExpenseCategoryInput) {
    const [cat] = await this.db
      .insert(schema.expenseCategories)
      .values({
        householdId,
        name: input.name.trim(),
        icon: input.icon?.trim() || null,
        color: input.color?.trim() || null,
        budgetLimit: input.budgetLimit ? String(input.budgetLimit) : null,
        createdBy: userId,
      })
      .returning();

    return {
      ...cat,
      budgetLimit: cat.budgetLimit ? Number(cat.budgetLimit) : null,
    };
  }

  async updateExpenseCategory(
    householdId: string,
    id: string,
    userId: string,
    input: UpdateExpenseCategoryInput
  ) {
    await this.getExpenseCategoryById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.icon !== undefined) updateData.icon = input.icon?.trim() || null;
    if (input.color !== undefined) updateData.color = input.color?.trim() || null;
    if (input.budgetLimit !== undefined) {
      updateData.budgetLimit = input.budgetLimit ? String(input.budgetLimit) : null;
    }

    const [updated] = await this.db
      .update(schema.expenseCategories)
      .set(updateData)
      .where(
        and(
          eq(schema.expenseCategories.id, id),
          eq(schema.expenseCategories.householdId, householdId)
        )
      )
      .returning();

    return {
      ...updated,
      budgetLimit: updated.budgetLimit ? Number(updated.budgetLimit) : null,
    };
  }

  async deleteExpenseCategory(householdId: string, id: string, userId: string) {
    await this.getExpenseCategoryById(householdId, id);

    await this.db
      .update(schema.expenseCategories)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.expenseCategories.id, id),
          eq(schema.expenseCategories.householdId, householdId)
        )
      );

    return null;
  }

  // ---------------------------------------------------------------------------
  // Incomes
  // ---------------------------------------------------------------------------

  async listIncomes(householdId: string, query: IncomeQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.incomes.householdId, householdId),
      isNull(schema.incomes.deletedAt),
    ];

    if (query.startDate) {
      conditions.push(gte(schema.incomes.date, query.startDate));
    }
    if (query.endDate) {
      conditions.push(lte(schema.incomes.date, query.endDate));
    }
    if (query.sourceId) {
      conditions.push(eq(schema.incomes.sourceId, query.sourceId));
    }
    if (query.categoryId) {
      conditions.push(eq(schema.incomes.categoryId, query.categoryId));
    }
    if (query.createdBy) {
      conditions.push(eq(schema.incomes.createdBy, query.createdBy));
    }
    if (query.search) {
      conditions.push(ilike(schema.incomes.notes, `%${query.search}%`));
    }

    const whereClause = and(...conditions);

    // Count
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.incomes)
      .where(whereClause);

    const total = Number(countRow?.count || 0);

    const rows = await this.db
      .select({
        id: schema.incomes.id,
        householdId: schema.incomes.householdId,
        sourceId: schema.incomes.sourceId,
        categoryId: schema.incomes.categoryId,
        date: schema.incomes.date,
        nominal: schema.incomes.nominal,
        notes: schema.incomes.notes,
        createdBy: schema.incomes.createdBy,
        updatedBy: schema.incomes.updatedBy,
        createdAt: schema.incomes.createdAt,
        updatedAt: schema.incomes.updatedAt,
        sourceName: schema.incomeSources.name,
        categoryName: schema.incomeCategories.name,
        categoryColor: schema.incomeCategories.color,
      })
      .from(schema.incomes)
      .leftJoin(
        schema.incomeSources,
        eq(schema.incomes.sourceId, schema.incomeSources.id)
      )
      .leftJoin(
        schema.incomeCategories,
        eq(schema.incomes.categoryId, schema.incomeCategories.id)
      )
      .where(whereClause)
      .orderBy(desc(schema.incomes.date), desc(schema.incomes.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      householdId: r.householdId,
      sourceId: r.sourceId,
      categoryId: r.categoryId,
      date: r.date,
      nominal: Number(r.nominal),
      notes: r.notes,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      source: r.sourceName ? { id: r.sourceId, name: r.sourceName } : undefined,
      category: r.categoryName
        ? { id: r.categoryId, name: r.categoryName, color: r.categoryColor }
        : null,
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

  async getIncomeById(householdId: string, id: string) {
    const [row] = await this.db
      .select({
        id: schema.incomes.id,
        householdId: schema.incomes.householdId,
        sourceId: schema.incomes.sourceId,
        categoryId: schema.incomes.categoryId,
        date: schema.incomes.date,
        nominal: schema.incomes.nominal,
        notes: schema.incomes.notes,
        createdBy: schema.incomes.createdBy,
        updatedBy: schema.incomes.updatedBy,
        createdAt: schema.incomes.createdAt,
        updatedAt: schema.incomes.updatedAt,
        sourceName: schema.incomeSources.name,
        categoryName: schema.incomeCategories.name,
        categoryColor: schema.incomeCategories.color,
      })
      .from(schema.incomes)
      .leftJoin(
        schema.incomeSources,
        eq(schema.incomes.sourceId, schema.incomeSources.id)
      )
      .leftJoin(
        schema.incomeCategories,
        eq(schema.incomes.categoryId, schema.incomeCategories.id)
      )
      .where(
        and(
          eq(schema.incomes.id, id),
          eq(schema.incomes.householdId, householdId),
          isNull(schema.incomes.deletedAt)
        )
      );

    if (!row) {
      throw new NotFoundException('Data pemasukan tidak ditemukan');
    }

    return {
      id: row.id,
      householdId: row.householdId,
      sourceId: row.sourceId,
      categoryId: row.categoryId,
      date: row.date,
      nominal: Number(row.nominal),
      notes: row.notes,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      source: row.sourceName ? { id: row.sourceId, name: row.sourceName } : undefined,
      category: row.categoryName
        ? { id: row.categoryId, name: row.categoryName, color: row.categoryColor }
        : null,
    };
  }

  async createIncome(householdId: string, userId: string, input: CreateIncomeInput) {
    if (input.nominal <= 0) {
      throw new UnprocessableEntityException('Nominal harus lebih dari 0');
    }

    // Verify source exists in household
    const [source] = await this.db
      .select()
      .from(schema.incomeSources)
      .where(
        and(
          eq(schema.incomeSources.id, input.sourceId),
          eq(schema.incomeSources.householdId, householdId),
          isNull(schema.incomeSources.deletedAt)
        )
      );

    if (!source) {
      throw new UnprocessableEntityException('Sumber pendapatan tidak valid');
    }

    const [income] = await this.db
      .insert(schema.incomes)
      .values({
        householdId,
        sourceId: input.sourceId,
        categoryId: input.categoryId || null,
        date: input.date,
        nominal: String(input.nominal),
        notes: input.notes?.trim() || null,
        createdBy: userId,
      })
      .returning();

    return {
      ...income,
      nominal: Number(income.nominal),
    };
  }

  async updateIncome(householdId: string, id: string, userId: string, input: UpdateIncomeInput) {
    await this.getIncomeById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.date !== undefined) updateData.date = input.date;
    if (input.nominal !== undefined) {
      if (input.nominal <= 0) {
        throw new UnprocessableEntityException('Nominal harus lebih dari 0');
      }
      updateData.nominal = String(input.nominal);
    }
    if (input.sourceId !== undefined) {
      const [source] = await this.db
        .select()
        .from(schema.incomeSources)
        .where(
          and(
            eq(schema.incomeSources.id, input.sourceId),
            eq(schema.incomeSources.householdId, householdId),
            isNull(schema.incomeSources.deletedAt)
          )
        );
      if (!source) throw new UnprocessableEntityException('Sumber pendapatan tidak valid');
      updateData.sourceId = input.sourceId;
    }
    if (input.categoryId !== undefined) {
      updateData.categoryId = input.categoryId;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes?.trim() || null;
    }

    const [updated] = await this.db
      .update(schema.incomes)
      .set(updateData)
      .where(
        and(
          eq(schema.incomes.id, id),
          eq(schema.incomes.householdId, householdId)
        )
      )
      .returning();

    return {
      ...updated,
      nominal: Number(updated.nominal),
    };
  }

  async deleteIncome(householdId: string, id: string, userId: string) {
    await this.getIncomeById(householdId, id);

    await this.db
      .update(schema.incomes)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.incomes.id, id),
          eq(schema.incomes.householdId, householdId)
        )
      );

    return null;
  }

  // ---------------------------------------------------------------------------
  // Expenses
  // ---------------------------------------------------------------------------

  async listExpenses(householdId: string, query: ExpenseQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.expenses.householdId, householdId),
      isNull(schema.expenses.deletedAt),
    ];

    if (query.startDate) {
      conditions.push(gte(schema.expenses.date, query.startDate));
    }
    if (query.endDate) {
      conditions.push(lte(schema.expenses.date, query.endDate));
    }
    if (query.categoryId) {
      conditions.push(eq(schema.expenses.categoryId, query.categoryId));
    }
    if (query.paymentMethod) {
      conditions.push(eq(schema.expenses.paymentMethod, query.paymentMethod));
    }
    if (query.purchaseId) {
      conditions.push(eq(schema.expenses.purchaseId, query.purchaseId));
    }
    if (query.createdBy) {
      conditions.push(eq(schema.expenses.createdBy, query.createdBy));
    }
    if (query.search) {
      conditions.push(ilike(schema.expenses.notes, `%${query.search}%`));
    }

    const whereClause = and(...conditions);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.expenses)
      .where(whereClause);

    const total = Number(countRow?.count || 0);

    const rows = await this.db
      .select({
        id: schema.expenses.id,
        householdId: schema.expenses.householdId,
        categoryId: schema.expenses.categoryId,
        purchaseId: schema.expenses.purchaseId,
        date: schema.expenses.date,
        nominal: schema.expenses.nominal,
        paymentMethod: schema.expenses.paymentMethod,
        notes: schema.expenses.notes,
        createdBy: schema.expenses.createdBy,
        updatedBy: schema.expenses.updatedBy,
        createdAt: schema.expenses.createdAt,
        updatedAt: schema.expenses.updatedAt,
        categoryName: schema.expenseCategories.name,
        categoryColor: schema.expenseCategories.color,
      })
      .from(schema.expenses)
      .leftJoin(
        schema.expenseCategories,
        eq(schema.expenses.categoryId, schema.expenseCategories.id)
      )
      .where(whereClause)
      .orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      householdId: r.householdId,
      categoryId: r.categoryId,
      purchaseId: r.purchaseId,
      date: r.date,
      nominal: Number(r.nominal),
      paymentMethod: r.paymentMethod,
      notes: r.notes,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      category: r.categoryName
        ? { id: r.categoryId, name: r.categoryName, color: r.categoryColor }
        : undefined,
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

  async getExpenseById(householdId: string, id: string) {
    const [row] = await this.db
      .select({
        id: schema.expenses.id,
        householdId: schema.expenses.householdId,
        categoryId: schema.expenses.categoryId,
        purchaseId: schema.expenses.purchaseId,
        date: schema.expenses.date,
        nominal: schema.expenses.nominal,
        paymentMethod: schema.expenses.paymentMethod,
        notes: schema.expenses.notes,
        createdBy: schema.expenses.createdBy,
        updatedBy: schema.expenses.updatedBy,
        createdAt: schema.expenses.createdAt,
        updatedAt: schema.expenses.updatedAt,
        categoryName: schema.expenseCategories.name,
        categoryColor: schema.expenseCategories.color,
      })
      .from(schema.expenses)
      .leftJoin(
        schema.expenseCategories,
        eq(schema.expenses.categoryId, schema.expenseCategories.id)
      )
      .where(
        and(
          eq(schema.expenses.id, id),
          eq(schema.expenses.householdId, householdId),
          isNull(schema.expenses.deletedAt)
        )
      );

    if (!row) {
      throw new NotFoundException('Data pengeluaran tidak ditemukan');
    }

    return {
      id: row.id,
      householdId: row.householdId,
      categoryId: row.categoryId,
      purchaseId: row.purchaseId,
      date: row.date,
      nominal: Number(row.nominal),
      paymentMethod: row.paymentMethod,
      notes: row.notes,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      category: row.categoryName
        ? { id: row.categoryId, name: row.categoryName, color: row.categoryColor }
        : undefined,
    };
  }

  async createExpense(householdId: string, userId: string, input: CreateExpenseInput) {
    if (!input.categoryId) {
      throw new UnprocessableEntityException('Kategori pengeluaran wajib dipilih');
    }
    if (input.nominal <= 0) {
      throw new UnprocessableEntityException('Nominal harus lebih dari 0');
    }

    // Verify category exists in household
    const [cat] = await this.db
      .select()
      .from(schema.expenseCategories)
      .where(
        and(
          eq(schema.expenseCategories.id, input.categoryId),
          eq(schema.expenseCategories.householdId, householdId),
          isNull(schema.expenseCategories.deletedAt)
        )
      );

    if (!cat) {
      throw new UnprocessableEntityException('Kategori pengeluaran tidak valid');
    }

    const [expense] = await this.db
      .insert(schema.expenses)
      .values({
        householdId,
        categoryId: input.categoryId,
        date: input.date,
        nominal: String(input.nominal),
        paymentMethod: input.paymentMethod || 'cash',
        notes: input.notes?.trim() || null,
        createdBy: userId,
      })
      .returning();

    return {
      ...expense,
      nominal: Number(expense.nominal),
    };
  }

  async updateExpense(householdId: string, id: string, userId: string, input: UpdateExpenseInput) {
    await this.getExpenseById(householdId, id);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (input.date !== undefined) updateData.date = input.date;
    if (input.nominal !== undefined) {
      if (input.nominal <= 0) {
        throw new UnprocessableEntityException('Nominal harus lebih dari 0');
      }
      updateData.nominal = String(input.nominal);
    }
    if (input.categoryId !== undefined) {
      const [cat] = await this.db
        .select()
        .from(schema.expenseCategories)
        .where(
          and(
            eq(schema.expenseCategories.id, input.categoryId),
            eq(schema.expenseCategories.householdId, householdId),
            isNull(schema.expenseCategories.deletedAt)
          )
        );
      if (!cat) throw new UnprocessableEntityException('Kategori pengeluaran tidak valid');
      updateData.categoryId = input.categoryId;
    }
    if (input.paymentMethod !== undefined) {
      updateData.paymentMethod = input.paymentMethod;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes?.trim() || null;
    }

    const [updated] = await this.db
      .update(schema.expenses)
      .set(updateData)
      .where(
        and(
          eq(schema.expenses.id, id),
          eq(schema.expenses.householdId, householdId)
        )
      )
      .returning();

    return {
      ...updated,
      nominal: Number(updated.nominal),
    };
  }

  async deleteExpense(householdId: string, id: string, userId: string) {
    await this.getExpenseById(householdId, id);

    await this.db
      .update(schema.expenses)
      .set({
        deletedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.expenses.id, id),
          eq(schema.expenses.householdId, householdId)
        )
      );

    return null;
  }

  // ---------------------------------------------------------------------------
  // Unified Transactions
  // ---------------------------------------------------------------------------

  async listTransactions(householdId: string, query: TransactionQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const offset = (page - 1) * limit;
    const type = query.type || 'all';

    const incConditions = [
      eq(schema.incomes.householdId, householdId),
      isNull(schema.incomes.deletedAt),
    ];
    if (query.startDate) {
      incConditions.push(gte(schema.incomes.date, query.startDate));
    }
    if (query.endDate) {
      incConditions.push(lte(schema.incomes.date, query.endDate));
    }
    if (query.categoryId) {
      incConditions.push(eq(schema.incomes.categoryId, query.categoryId));
    }
    if (query.search) {
      incConditions.push(
        or(
          ilike(schema.incomes.notes, `%${query.search}%`),
          ilike(schema.incomeCategories.name, `%${query.search}%`),
          ilike(schema.incomeSources.name, `%${query.search}%`)
        )!
      );
    }

    const expConditions = [
      eq(schema.expenses.householdId, householdId),
      isNull(schema.expenses.deletedAt),
    ];
    if (query.startDate) {
      expConditions.push(gte(schema.expenses.date, query.startDate));
    }
    if (query.endDate) {
      expConditions.push(lte(schema.expenses.date, query.endDate));
    }
    if (query.categoryId) {
      expConditions.push(eq(schema.expenses.categoryId, query.categoryId));
    }
    if (query.search) {
      expConditions.push(
        or(
          ilike(schema.expenses.notes, `%${query.search}%`),
          ilike(schema.expenseCategories.name, `%${query.search}%`)
        )!
      );
    }

    let rows: Array<{
      id: string;
      type: string;
      date: string;
      nominal: string | number;
      categoryName: string | null;
      sourceName: string | null;
      paymentMethod: string | null;
      notes: string | null;
      createdAt: Date;
    }> = [];
    let total = 0;

    if (type === 'income') {
      const whereClause = and(...incConditions);
      const [countRow] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.incomes)
        .leftJoin(
          schema.incomeCategories,
          eq(schema.incomes.categoryId, schema.incomeCategories.id)
        )
        .leftJoin(
          schema.incomeSources,
          eq(schema.incomes.sourceId, schema.incomeSources.id)
        )
        .where(whereClause);

      total = Number(countRow?.count || 0);

      const incRows = await this.db
        .select({
          id: schema.incomes.id,
          type: sql<string>`'income'`.as('type'),
          date: schema.incomes.date,
          nominal: schema.incomes.nominal,
          categoryName: sql<string | null>`${schema.incomeCategories.name}`.as('category_name'),
          sourceName: sql<string | null>`${schema.incomeSources.name}`.as('source_name'),
          paymentMethod: sql<string | null>`NULL`.as('payment_method'),
          notes: schema.incomes.notes,
          createdAt: schema.incomes.createdAt,
        })
        .from(schema.incomes)
        .leftJoin(
          schema.incomeCategories,
          eq(schema.incomes.categoryId, schema.incomeCategories.id)
        )
        .leftJoin(
          schema.incomeSources,
          eq(schema.incomes.sourceId, schema.incomeSources.id)
        )
        .where(whereClause)
        .orderBy(desc(schema.incomes.date), desc(schema.incomes.createdAt))
        .limit(limit)
        .offset(offset);

      rows = incRows;
    } else if (type === 'expense') {
      const whereClause = and(...expConditions);
      const [countRow] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.expenses)
        .leftJoin(
          schema.expenseCategories,
          eq(schema.expenses.categoryId, schema.expenseCategories.id)
        )
        .where(whereClause);

      total = Number(countRow?.count || 0);

      const expRows = await this.db
        .select({
          id: schema.expenses.id,
          type: sql<string>`'expense'`.as('type'),
          date: schema.expenses.date,
          nominal: schema.expenses.nominal,
          categoryName: sql<string | null>`${schema.expenseCategories.name}`.as('category_name'),
          sourceName: sql<string | null>`NULL`.as('source_name'),
          paymentMethod: sql<string | null>`${schema.expenses.paymentMethod}::text`.as('payment_method'),
          notes: schema.expenses.notes,
          createdAt: schema.expenses.createdAt,
        })
        .from(schema.expenses)
        .leftJoin(
          schema.expenseCategories,
          eq(schema.expenses.categoryId, schema.expenseCategories.id)
        )
        .where(whereClause)
        .orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt))
        .limit(limit)
        .offset(offset);

      rows = expRows;
    } else {
      // type === 'all'
      const incSelect = this.db
        .select({
          id: schema.incomes.id,
          type: sql<string>`'income'`.as('type'),
          date: schema.incomes.date,
          nominal: schema.incomes.nominal,
          categoryName: sql<string | null>`${schema.incomeCategories.name}`.as('category_name'),
          sourceName: sql<string | null>`${schema.incomeSources.name}`.as('source_name'),
          paymentMethod: sql<string | null>`NULL`.as('payment_method'),
          notes: schema.incomes.notes,
          createdAt: schema.incomes.createdAt,
        })
        .from(schema.incomes)
        .leftJoin(
          schema.incomeCategories,
          eq(schema.incomes.categoryId, schema.incomeCategories.id)
        )
        .leftJoin(
          schema.incomeSources,
          eq(schema.incomes.sourceId, schema.incomeSources.id)
        )
        .where(and(...incConditions));

      const expSelect = this.db
        .select({
          id: schema.expenses.id,
          type: sql<string>`'expense'`.as('type'),
          date: schema.expenses.date,
          nominal: schema.expenses.nominal,
          categoryName: sql<string | null>`${schema.expenseCategories.name}`.as('category_name'),
          sourceName: sql<string | null>`NULL`.as('source_name'),
          paymentMethod: sql<string | null>`${schema.expenses.paymentMethod}::text`.as('payment_method'),
          notes: schema.expenses.notes,
          createdAt: schema.expenses.createdAt,
        })
        .from(schema.expenses)
        .leftJoin(
          schema.expenseCategories,
          eq(schema.expenses.categoryId, schema.expenseCategories.id)
        )
        .where(and(...expConditions));

      const combined = incSelect.unionAll(expSelect).as('combined_transactions');

      const [countRow] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(combined);

      total = Number(countRow?.count || 0);

      const combinedRows = await this.db
        .select()
        .from(combined)
        .orderBy(desc(combined.date), desc(combined.createdAt))
        .limit(limit)
        .offset(offset);

      rows = combinedRows;
    }

    const data = rows.map((r) => ({
      id: r.id,
      type: r.type as 'income' | 'expense',
      date: r.date,
      nominal: Number(r.nominal),
      categoryName: r.categoryName || (r.type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
      sourceName: r.sourceName || null,
      paymentMethod: r.paymentMethod || null,
      notes: r.notes || null,
      createdAt: r.createdAt,
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
}
