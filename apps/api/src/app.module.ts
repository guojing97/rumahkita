import { Module, Controller, Get } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DbModule } from './modules/db/db.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HouseholdModule } from './modules/household/household.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PurchasesModule } from './modules/purchases/purchases.module.js';
import { DebtsModule } from './modules/debts/debts.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { HouseholdGuard } from './common/guards/household.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { Public } from './common/decorators/public.decorator.js';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'System Health Check' })
  @ApiResponse({ status: 200, description: 'Application is operational' })
  getHealth() {
    return {
      status: 'ok',
      service: 'RumahKita API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    DbModule,
    AuthModule,
    HouseholdModule,
    FinanceModule,
    InventoryModule,
    PurchasesModule,
    DebtsModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: HouseholdGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
