import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { DashboardController } from './dashboard.controller.js';
import { ReportsController } from './reports.controller.js';

@Module({
  controllers: [DashboardController, ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
