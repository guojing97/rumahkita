import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  monthlyReportQuerySchema,
  yearlyReportQuerySchema,
  csvExportQuerySchema,
  MonthlyReportQuery,
  YearlyReportQuery,
  CsvExportQuery,
} from '@rumahkita/contracts';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly financial report' })
  async getMonthlyReport(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(monthlyReportQuerySchema)) query: MonthlyReportQuery
  ) {
    const data = await this.reportsService.getMonthlyReport(
      householdId,
      query.year,
      query.month
    );
    return {
      success: true,
      data,
    };
  }

  @Get('yearly')
  @ApiOperation({ summary: 'Get yearly financial report with zero continuity' })
  async getYearlyReport(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(yearlyReportQuerySchema)) query: YearlyReportQuery
  ) {
    const data = await this.reportsService.getYearlyReport(householdId, query.year);
    return {
      success: true,
      data,
    };
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export financial transactions as RFC 4180 Indonesian CSV' })
  async exportCsv(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(csvExportQuerySchema)) query: CsvExportQuery,
    @Res() res: Response
  ) {
    const csvContent = await this.reportsService.exportCsv(
      householdId,
      query.type,
      query.startDate,
      query.endDate
    );

    const filename = `transaksi-rumahkita-${query.type || 'transactions'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  }
}
