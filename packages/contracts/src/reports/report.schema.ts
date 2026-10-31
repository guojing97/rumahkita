import { z } from 'zod';

export const dashboardPeriodEnum = z.enum(['THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM']);
export type DashboardPeriod = z.infer<typeof dashboardPeriodEnum>;

export const dashboardQuerySchema = z.object({
  period: dashboardPeriodEnum.default('THIS_MONTH'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const dashboardSummaryResponseSchema = z.object({
  period: dashboardPeriodEnum,
  startDate: z.string(),
  endDate: z.string(),
  totalIncome: z.number(),
  totalExpense: z.number(),
  netCashFlow: z.number(),
  openDebtsTotal: z.number(),
  openReceivablesTotal: z.number(),
  lowStockCount: z.number(),
  outOfStockCount: z.number(),
  recentTransactions: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(['income', 'expense']),
      date: z.string(),
      nominal: z.number(),
      categoryOrSource: z.string(),
      notes: z.string().nullable().optional(),
      recordedByName: z.string().optional(),
    })
  ),
  lowStockItems: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      unit: z.string(),
      quantityOnHand: z.number().int(),
      lowStockThreshold: z.number().int(),
      status: z.enum(['SAFE', 'LOW', 'OUT']),
    })
  ),
  dueSoonDebts: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.enum(['payable', 'receivable']),
      partyName: z.string(),
      remainingBalance: z.number(),
      dueDate: z.string(),
      status: z.string(),
    })
  ),
});

export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;

export const monthlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2099),
  month: z.coerce.number().int().min(1).max(12),
});

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;

export const monthlyReportResponseSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  totalIncome: z.number(),
  totalExpense: z.number(),
  netCashFlow: z.number(),
  expenseByCategory: z.array(
    z.object({
      categoryId: z.string().uuid(),
      categoryName: z.string(),
      color: z.string().nullable().optional(),
      nominal: z.number(),
      percentage: z.number(),
    })
  ),
  incomeBySource: z.array(
    z.object({
      sourceId: z.string().uuid(),
      sourceName: z.string(),
      nominal: z.number(),
      percentage: z.number(),
    })
  ),
  dailyTrend: z.array(
    z.object({
      date: z.string(),
      income: z.number(),
      expense: z.number(),
    })
  ),
});

export type MonthlyReportResponse = z.infer<typeof monthlyReportResponseSchema>;

export const yearlyReportQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2099),
});

export type YearlyReportQuery = z.infer<typeof yearlyReportQuerySchema>;

export const yearlyReportResponseSchema = z.object({
  year: z.number().int(),
  totalIncome: z.number(),
  totalExpense: z.number(),
  netCashFlow: z.number(),
  monthlyTrend: z.array(
    z.object({
      month: z.number().int().min(1).max(12),
      monthName: z.string(),
      income: z.number(),
      expense: z.number(),
      net: z.number(),
    })
  ),
});

export type YearlyReportResponse = z.infer<typeof yearlyReportResponseSchema>;

export const csvExportQuerySchema = z.object({
  type: z.enum(['incomes', 'expenses', 'transactions']).default('transactions'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CsvExportQuery = z.infer<typeof csvExportQuerySchema>;
