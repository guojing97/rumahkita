import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service.js';
import { IncomeSourcesController } from './income-sources.controller.js';
import { IncomeCategoriesController } from './income-categories.controller.js';
import { ExpenseCategoriesController } from './expense-categories.controller.js';
import { IncomesController } from './incomes.controller.js';
import { ExpensesController } from './expenses.controller.js';
import { TransactionsController } from './transactions.controller.js';

@Module({
  controllers: [
    IncomeSourcesController,
    IncomeCategoriesController,
    ExpenseCategoriesController,
    IncomesController,
    ExpensesController,
    TransactionsController,
  ],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
