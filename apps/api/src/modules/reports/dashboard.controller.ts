import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(['', 'summary'])
  @ApiOperation({ summary: 'Get dashboard summary cards, recent transactions and low stock items' })
  async getDashboardSummary(
    @CurrentHouseholdId() householdId: string,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const data = await this.reportsService.getDashboardSummary(
      householdId,
      period || 'this_month',
      startDate,
      endDate
    );
    return {
      success: true,
      data,
    };
  }
}
