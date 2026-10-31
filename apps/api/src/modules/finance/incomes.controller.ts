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
import { FinanceService } from './finance.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createIncomeSchema,
  updateIncomeSchema,
  incomeQuerySchema,
  CreateIncomeInput,
  UpdateIncomeInput,
  IncomeQuery,
} from '@rumahkita/contracts';

@ApiTags('Incomes')
@Controller('incomes')
export class IncomesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter incomes with pagination' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(incomeQuerySchema)) query: IncomeQuery
  ) {
    const result = await this.financeService.listIncomes(householdId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get income by ID' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.financeService.getIncomeById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record new income' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createIncomeSchema)) body: CreateIncomeInput
  ) {
    const data = await this.financeService.createIncome(householdId, userId, body);
    return {
      success: true,
      data,
      message: 'Pemasukan berhasil dicatat',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update income record' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateIncomeSchema)) body: UpdateIncomeInput
  ) {
    const data = await this.financeService.updateIncome(householdId, id, userId, body);
    return {
      success: true,
      data,
      message: 'Pemasukan berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete income record' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.financeService.deleteIncome(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Pemasukan berhasil dihapus',
    };
  }
}
