import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FinanceService } from './finance.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  transactionQuerySchema,
  TransactionQuery,
} from '@rumahkita/contracts';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter unified transactions with server-side pagination' })
  @ApiResponse({ status: 200, description: 'Unified transaction list with pagination metadata' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(transactionQuerySchema)) query: TransactionQuery
  ) {
    const result = await this.financeService.listTransactions(householdId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }
}
