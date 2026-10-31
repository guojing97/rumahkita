import { Module } from '@nestjs/common';
import { DebtsService } from './debts.service.js';
import { DebtsController } from './debts.controller.js';

@Module({
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
