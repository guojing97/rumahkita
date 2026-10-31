import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DebtsService } from './debts.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createDebtReceivableSchema,
  updateDebtReceivableSchema,
  debtReceivableQuerySchema,
  recordPaymentSchema,
  CreateDebtReceivableInput,
  UpdateDebtReceivableInput,
  DebtReceivableQuery,
  RecordPaymentInput,
} from '@rumahkita/contracts';

@ApiTags('Debts and Receivables')
@Controller('debts-receivables')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter debts and receivables' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(debtReceivableQuerySchema)) query: DebtReceivableQuery
  ) {
    const result = await this.debtsService.listDebts(householdId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get debt/receivable by ID with payment history' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.debtsService.getDebtById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new debt or receivable' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createDebtReceivableSchema)) body: CreateDebtReceivableInput
  ) {
    const data = await this.debtsService.createDebt(householdId, userId, body);
    return {
      success: true,
      data,
      message: 'Data hutang/piutang berhasil dibuat',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update debt or receivable' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateDebtReceivableSchema)) body: UpdateDebtReceivableInput
  ) {
    const data = await this.debtsService.updateDebt(householdId, id, userId, body);
    return {
      success: true,
      data,
      message: 'Data hutang/piutang berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete debt or receivable' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.debtsService.deleteDebt(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Data hutang/piutang berhasil dihapus',
    };
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record debt or receivable repayment' })
  async recordPayment(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput
  ) {
    const data = await this.debtsService.recordPayment(householdId, id, userId, body);
    return {
      success: true,
      data,
      message: 'Pembayaran berhasil dicatat',
    };
  }
}
