import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc, gte, lte, sql } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';
import { calculateStockStatusLabel } from '../inventory/inventory.service.js';

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

@Injectable()
export class ReportsService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  private resolvePeriodDates(period = 'this_month', customStart?: string, customEnd?: string) {
    const now = new Date();
    const p = period.toLowerCase();

    if (p === 'last_month') {
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const start = new Date(Date.UTC(year, month, 1));
      const end = new Date(Date.UTC(year, month + 1, 0));
      return {
        startDate: start.toISOString().split('T')[0]!,
        endDate: end.toISOString().split('T')[0]!,
      };
    }

    if (p === 'this_year') {
      const year = now.getFullYear();
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }

    if (p === 'custom' && customStart && customEnd) {
      return {
        startDate: customStart,
        endDate: customEnd,
      };
    }

    // Default: this_month
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    return {
      startDate: start.toISOString().split('T')[0]!,
      endDate: end.toISOString().split('T')[0]!,
    };
  }

  async getDashboardSummary(
    householdId: string,
    period = 'this_month',
    customStart?: string,
    customEnd?: string
  ) {
    const { startDate, endDate } = this.resolvePeriodDates(period, customStart, customEnd);

    // 1. Total Income
    const [incomeRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.incomes.nominal}), 0)` })
      .from(schema.incomes)
      .where(
        and(
          eq(schema.incomes.householdId, householdId),
          gte(schema.incomes.date, startDate),
          lte(schema.incomes.date, endDate),
          isNull(schema.incomes.deletedAt)
        )
      );
    const totalIncome = Number(incomeRow?.total || 0);

    // 2. Total Expense
    const [expenseRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.expenses.nominal}), 0)` })
      .from(schema.expenses)
      .where(
        and(
          eq(schema.expenses.householdId, householdId),
          gte(schema.expenses.date, startDate),
          lte(schema.expenses.date, endDate),
          isNull(schema.expenses.deletedAt)
        )
      );
    const totalExpense = Number(expenseRow?.total || 0);

    const netCashFlow = totalIncome - totalExpense;

    // 3. Open Debts & Receivables
    const [debtsRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.debtsReceivables.remainingBalance}), 0)` })
      .from(schema.debtsReceivables)
      .where(
        and(
          eq(schema.debtsReceivables.householdId, householdId),
          eq(schema.debtsReceivables.type, 'payable'),
          sql`${schema.debtsReceivables.status} in ('open', 'partially_paid', 'overdue')`,
          isNull(schema.debtsReceivables.deletedAt)
        )
      );
    const openDebtsTotal = Number(debtsRow?.total || 0);

    const [receivablesRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.debtsReceivables.remainingBalance}), 0)` })
      .from(schema.debtsReceivables)
      .where(
        and(
          eq(schema.debtsReceivables.householdId, householdId),
          eq(schema.debtsReceivables.type, 'receivable'),
          sql`${schema.debtsReceivables.status} in ('open', 'partially_paid', 'overdue')`,
          isNull(schema.debtsReceivables.deletedAt)
        )
      );
    const openReceivablesTotal = Number(receivablesRow?.total || 0);

    // 4. Low stock items (quantityOnHand <= lowStockThreshold)
    const allItems = await this.db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.householdId, householdId),
          isNull(schema.items.deletedAt)
        )
      );

    const lowStockItems = allItems
      .filter((i) => i.quantityOnHand <= i.lowStockThreshold)
      .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        quantityOnHand: i.quantityOnHand,
        currentStock: i.quantityOnHand,
        lowStockThreshold: i.lowStockThreshold,
        threshold: i.lowStockThreshold,
        status: calculateStockStatusLabel(i.quantityOnHand, i.lowStockThreshold),
      }));

    const lowStockCount = lowStockItems.filter((i) => i.status === 'Menipis').length;
    const outOfStockCount = lowStockItems.filter((i) => i.status === 'Habis').length;

    // 5. Recent transactions (latest 10 merged incomes & expenses)
    const recentIncomes = await this.db
      .select({
        id: schema.incomes.id,
        date: schema.incomes.date,
        nominal: schema.incomes.nominal,
        notes: schema.incomes.notes,
        createdAt: schema.incomes.createdAt,
        categoryOrSource: schema.incomeSources.name,
      })
      .from(schema.incomes)
      .leftJoin(
        schema.incomeSources,
        eq(schema.incomes.sourceId, schema.incomeSources.id)
      )
      .where(
        and(
          eq(schema.incomes.householdId, householdId),
          isNull(schema.incomes.deletedAt)
        )
      )
      .orderBy(desc(schema.incomes.date), desc(schema.incomes.createdAt))
      .limit(10);

    const recentExpenses = await this.db
      .select({
        id: schema.expenses.id,
        date: schema.expenses.date,
        nominal: schema.expenses.nominal,
        notes: schema.expenses.notes,
        createdAt: schema.expenses.createdAt,
        categoryOrSource: schema.expenseCategories.name,
      })
      .from(schema.expenses)
      .leftJoin(
        schema.expenseCategories,
        eq(schema.expenses.categoryId, schema.expenseCategories.id)
      )
      .where(
        and(
          eq(schema.expenses.householdId, householdId),
          isNull(schema.expenses.deletedAt)
        )
      )
      .orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt))
      .limit(10);

    const mergedTransactions = [
      ...recentIncomes.map((inc) => ({
        id: inc.id,
        type: 'income' as const,
        date: inc.date,
        nominal: Number(inc.nominal),
        categoryOrSource: inc.categoryOrSource || 'Pemasukan',
        notes: inc.notes,
        createdAt: inc.createdAt,
      })),
      ...recentExpenses.map((exp) => ({
        id: exp.id,
        type: 'expense' as const,
        date: exp.date,
        nominal: Number(exp.nominal),
        categoryOrSource: exp.categoryOrSource || 'Pengeluaran',
        notes: exp.notes,
        createdAt: exp.createdAt,
      })),
    ]
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 10);

    // 6. Due soon debts
    const dueSoonDebts = await this.db
      .select({
        id: schema.debtsReceivables.id,
        type: schema.debtsReceivables.type,
        partyName: schema.debtsReceivables.partyName,
        remainingBalance: schema.debtsReceivables.remainingBalance,
        dueDate: schema.debtsReceivables.dueDate,
        status: schema.debtsReceivables.status,
      })
      .from(schema.debtsReceivables)
      .where(
        and(
          eq(schema.debtsReceivables.householdId, householdId),
          sql`${schema.debtsReceivables.status} in ('open', 'partially_paid', 'overdue')`,
          isNull(schema.debtsReceivables.deletedAt)
        )
      )
      .orderBy(schema.debtsReceivables.dueDate)
      .limit(5);

    return {
      period: period.toUpperCase(),
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      netCashFlow,
      summaryCards: {
        totalIncome,
        totalExpense,
        netCashFlow,
        openDebtsTotal,
        openReceivablesTotal,
      },
      openDebtsTotal,
      openReceivablesTotal,
      lowStockCount,
      outOfStockCount,
      lowStockItems,
      recentTransactions: mergedTransactions,
      dueSoonDebts: dueSoonDebts.map((d) => ({
        ...d,
        remainingBalance: Number(d.remainingBalance),
        dueDate: d.dueDate || '',
      })),
    };
  }

  async getMonthlyReport(householdId: string, year: number, month: number) {
    const padMonth = String(month).padStart(2, '0');
    const startDay = `${year}-${padMonth}-01`;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getDate();
    const endDay = `${year}-${padMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Total income
    const [incRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.incomes.nominal}), 0)` })
      .from(schema.incomes)
      .where(
        and(
          eq(schema.incomes.householdId, householdId),
          gte(schema.incomes.date, startDay),
          lte(schema.incomes.date, endDay),
          isNull(schema.incomes.deletedAt)
        )
      );
    const totalIncome = Number(incRow?.total || 0);

    // Total expense
    const [expRow] = await this.db
      .select({ total: sql<string>`coalesce(sum(${schema.expenses.nominal}), 0)` })
      .from(schema.expenses)
      .where(
        and(
          eq(schema.expenses.householdId, householdId),
          gte(schema.expenses.date, startDay),
          lte(schema.expenses.date, endDay),
          isNull(schema.expenses.deletedAt)
        )
      );
    const totalExpense = Number(expRow?.total || 0);

    const netCashFlow = totalIncome - totalExpense;

    // Expense by category
    const expenseByCatRows = await this.db
      .select({
        categoryId: schema.expenses.categoryId,
        categoryName: schema.expenseCategories.name,
        color: schema.expenseCategories.color,
        budgetLimit: schema.expenseCategories.budgetLimit,
        nominal: sql<string>`coalesce(sum(${schema.expenses.nominal}), 0)`,
      })
      .from(schema.expenses)
      .innerJoin(
        schema.expenseCategories,
        eq(schema.expenses.categoryId, schema.expenseCategories.id)
      )
      .where(
        and(
          eq(schema.expenses.householdId, householdId),
          gte(schema.expenses.date, startDay),
          lte(schema.expenses.date, endDay),
          isNull(schema.expenses.deletedAt)
        )
      )
      .groupBy(
        schema.expenses.categoryId,
        schema.expenseCategories.name,
        schema.expenseCategories.color,
        schema.expenseCategories.budgetLimit
      );

    const expenseByCategory = expenseByCatRows.map((row) => {
      const nominal = Number(row.nominal);
      const percentage = totalExpense > 0 ? (nominal / totalExpense) * 100 : 0;
      return {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        color: row.color,
        nominal,
        percentage: Math.round(percentage * 10) / 10,
        budgetLimit: row.budgetLimit ? Number(row.budgetLimit) : null,
      };
    });

    // Income by source
    const incomeBySourceRows = await this.db
      .select({
        sourceId: schema.incomes.sourceId,
        sourceName: schema.incomeSources.name,
        nominal: sql<string>`coalesce(sum(${schema.incomes.nominal}), 0)`,
      })
      .from(schema.incomes)
      .innerJoin(
        schema.incomeSources,
        eq(schema.incomes.sourceId, schema.incomeSources.id)
      )
      .where(
        and(
          eq(schema.incomes.householdId, householdId),
          gte(schema.incomes.date, startDay),
          lte(schema.incomes.date, endDay),
          isNull(schema.incomes.deletedAt)
        )
      )
      .groupBy(schema.incomes.sourceId, schema.incomeSources.name);

    const incomeBySource = incomeBySourceRows.map((row) => {
      const nominal = Number(row.nominal);
      const percentage = totalIncome > 0 ? (nominal / totalIncome) * 100 : 0;
      return {
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        nominal,
        percentage: Math.round(percentage * 10) / 10,
      };
    });

    // Daily trend
    const allIncomes = await this.db
      .select({ date: schema.incomes.date, nominal: schema.incomes.nominal })
      .from(schema.incomes)
      .where(
        and(
          eq(schema.incomes.householdId, householdId),
          gte(schema.incomes.date, startDay),
          lte(schema.incomes.date, endDay),
          isNull(schema.incomes.deletedAt)
        )
      );

    const allExpenses = await this.db
      .select({ date: schema.expenses.date, nominal: schema.expenses.nominal })
      .from(schema.expenses)
      .where(
        and(
          eq(schema.expenses.householdId, householdId),
          gte(schema.expenses.date, startDay),
          lte(schema.expenses.date, endDay),
          isNull(schema.expenses.deletedAt)
        )
      );

    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (let d = 1; d <= lastDayOfMonth; d++) {
      const dayStr = `${year}-${padMonth}-${String(d).padStart(2, '0')}`;
      dailyMap.set(dayStr, { income: 0, expense: 0 });
    }

    for (const inc of allIncomes) {
      const cur = dailyMap.get(inc.date);
      if (cur) cur.income += Number(inc.nominal);
    }

    for (const exp of allExpenses) {
      const cur = dailyMap.get(exp.date);
      if (cur) cur.expense += Number(exp.nominal);
    }

    const dailyTrend = Array.from(dailyMap.entries()).map(([date, val]) => ({
      date,
      income: val.income,
      expense: val.expense,
    }));

    return {
      year,
      month,
      totalIncome,
      totalExpense,
      netCashFlow,
      expenseByCategory,
      incomeBySource,
      dailyTrend,
    };
  }

  async getYearlyReport(householdId: string, year: number) {
    const startYear = `${year}-01-01`;
    const endYear = `${year}-12-31`;

    const allIncomes = await this.db
      .select({ date: schema.incomes.date, nominal: schema.incomes.nominal })
      .from(schema.incomes)
      .where(
        and(
          eq(schema.incomes.householdId, householdId),
          gte(schema.incomes.date, startYear),
          lte(schema.incomes.date, endYear),
          isNull(schema.incomes.deletedAt)
        )
      );

    const allExpenses = await this.db
      .select({ date: schema.expenses.date, nominal: schema.expenses.nominal })
      .from(schema.expenses)
      .where(
        and(
          eq(schema.expenses.householdId, householdId),
          gte(schema.expenses.date, startYear),
          lte(schema.expenses.date, endYear),
          isNull(schema.expenses.deletedAt)
        )
      );

    let yearlyTotalIncome = 0;
    let yearlyTotalExpense = 0;

    const monthlyTrends = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const monthPrefix = `${year}-${String(monthNum).padStart(2, '0')}`;

      const incTotal = allIncomes
        .filter((inc) => inc.date.startsWith(monthPrefix))
        .reduce((sum, item) => sum + Number(item.nominal), 0);

      const expTotal = allExpenses
        .filter((exp) => exp.date.startsWith(monthPrefix))
        .reduce((sum, item) => sum + Number(item.nominal), 0);

      yearlyTotalIncome += incTotal;
      yearlyTotalExpense += expTotal;

      return {
        month: monthNum,
        monthName: INDONESIAN_MONTHS[i]!,
        income: incTotal,
        expense: expTotal,
        net: incTotal - expTotal,
      };
    });

    return {
      year,
      totalIncome: yearlyTotalIncome,
      totalExpense: yearlyTotalExpense,
      netCashFlow: yearlyTotalIncome - yearlyTotalExpense,
      monthlyTrends,
      monthlyTrend: monthlyTrends, // Alias for contract compatibility
    };
  }

  async exportCsv(
    householdId: string,
    type: 'transactions' | 'incomes' | 'expenses' = 'transactions',
    startDate?: string,
    endDate?: string
  ): Promise<string> {
    const csvEscape = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = '\uFEFF'; // UTF-8 BOM

    if (type === 'incomes') {
      const conditions = [
        eq(schema.incomes.householdId, householdId),
        isNull(schema.incomes.deletedAt),
      ];
      if (startDate) conditions.push(gte(schema.incomes.date, startDate));
      if (endDate) conditions.push(lte(schema.incomes.date, endDate));

      const rows = await this.db
        .select({
          date: schema.incomes.date,
          nominal: schema.incomes.nominal,
          notes: schema.incomes.notes,
          sourceName: schema.incomeSources.name,
          categoryName: schema.incomeCategories.name,
          recordedBy: schema.users.fullName,
        })
        .from(schema.incomes)
        .leftJoin(schema.incomeSources, eq(schema.incomes.sourceId, schema.incomeSources.id))
        .leftJoin(schema.incomeCategories, eq(schema.incomes.categoryId, schema.incomeCategories.id))
        .leftJoin(schema.users, eq(schema.incomes.createdBy, schema.users.id))
        .where(and(...conditions))
        .orderBy(desc(schema.incomes.date));

      csvContent += 'Tanggal,Sumber,Kategori,Nominal,Catatan,Pencatat\r\n';
      for (const r of rows) {
        csvContent += [
          csvEscape(r.date),
          csvEscape(r.sourceName || '-'),
          csvEscape(r.categoryName || '-'),
          Number(r.nominal),
          csvEscape(r.notes || '-'),
          csvEscape(r.recordedBy || '-'),
        ].join(',') + '\r\n';
      }
      return csvContent;
    }

    if (type === 'expenses') {
      const conditions = [
        eq(schema.expenses.householdId, householdId),
        isNull(schema.expenses.deletedAt),
      ];
      if (startDate) conditions.push(gte(schema.expenses.date, startDate));
      if (endDate) conditions.push(lte(schema.expenses.date, endDate));

      const rows = await this.db
        .select({
          date: schema.expenses.date,
          nominal: schema.expenses.nominal,
          paymentMethod: schema.expenses.paymentMethod,
          notes: schema.expenses.notes,
          categoryName: schema.expenseCategories.name,
          recordedBy: schema.users.fullName,
        })
        .from(schema.expenses)
        .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
        .leftJoin(schema.users, eq(schema.expenses.createdBy, schema.users.id))
        .where(and(...conditions))
        .orderBy(desc(schema.expenses.date));

      csvContent += 'Tanggal,Kategori,Nominal,Metode Pembayaran,Catatan,Pencatat\r\n';
      for (const r of rows) {
        csvContent += [
          csvEscape(r.date),
          csvEscape(r.categoryName || '-'),
          Number(r.nominal),
          csvEscape(r.paymentMethod || 'cash'),
          csvEscape(r.notes || '-'),
          csvEscape(r.recordedBy || '-'),
        ].join(',') + '\r\n';
      }
      return csvContent;
    }

    // Default: 'transactions' (Combined incomes and expenses)
    const incConditions = [
      eq(schema.incomes.householdId, householdId),
      isNull(schema.incomes.deletedAt),
    ];
    if (startDate) incConditions.push(gte(schema.incomes.date, startDate));
    if (endDate) incConditions.push(lte(schema.incomes.date, endDate));

    const expConditions = [
      eq(schema.expenses.householdId, householdId),
      isNull(schema.expenses.deletedAt),
    ];
    if (startDate) expConditions.push(gte(schema.expenses.date, startDate));
    if (endDate) expConditions.push(lte(schema.expenses.date, endDate));

    const incomes = await this.db
      .select({
        date: schema.incomes.date,
        nominal: schema.incomes.nominal,
        notes: schema.incomes.notes,
        sourceName: schema.incomeSources.name,
        recordedBy: schema.users.fullName,
        createdAt: schema.incomes.createdAt,
      })
      .from(schema.incomes)
      .leftJoin(schema.incomeSources, eq(schema.incomes.sourceId, schema.incomeSources.id))
      .leftJoin(schema.users, eq(schema.incomes.createdBy, schema.users.id))
      .where(and(...incConditions));

    const expenses = await this.db
      .select({
        date: schema.expenses.date,
        nominal: schema.expenses.nominal,
        paymentMethod: schema.expenses.paymentMethod,
        notes: schema.expenses.notes,
        categoryName: schema.expenseCategories.name,
        recordedBy: schema.users.fullName,
        createdAt: schema.expenses.createdAt,
      })
      .from(schema.expenses)
      .leftJoin(schema.expenseCategories, eq(schema.expenses.categoryId, schema.expenseCategories.id))
      .leftJoin(schema.users, eq(schema.expenses.createdBy, schema.users.id))
      .where(and(...expConditions));

    const allTx = [
      ...incomes.map((i) => ({
        date: i.date,
        type: 'Pemasukan',
        categoryOrSource: i.sourceName || 'Pemasukan',
        nominal: Number(i.nominal),
        paymentMethod: '-',
        notes: i.notes || '-',
        recordedBy: i.recordedBy || '-',
        createdAt: i.createdAt,
      })),
      ...expenses.map((e) => ({
        date: e.date,
        type: 'Pengeluaran',
        categoryOrSource: e.categoryName || 'Pengeluaran',
        nominal: Number(e.nominal),
        paymentMethod: e.paymentMethod || 'cash',
        notes: e.notes || '-',
        recordedBy: e.recordedBy || '-',
        createdAt: e.createdAt,
      })),
    ].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    csvContent += 'Tanggal,Tipe,Kategori / Sumber,Nominal,Metode Pembayaran,Catatan,Pencatat\r\n';
    for (const tx of allTx) {
      csvContent += [
        csvEscape(tx.date),
        csvEscape(tx.type),
        csvEscape(tx.categoryOrSource),
        tx.nominal,
        csvEscape(tx.paymentMethod),
        csvEscape(tx.notes),
        csvEscape(tx.recordedBy),
      ].join(',') + '\r\n';
    }

    return csvContent;
  }
}
