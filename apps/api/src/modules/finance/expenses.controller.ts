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
  createExpenseSchema,
  updateExpenseSchema,
  expenseQuerySchema,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseQuery,
} from '@rumahkita/contracts';

@ApiTags('Expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter expenses with pagination' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(expenseQuerySchema)) query: ExpenseQuery
  ) {
    const result = await this.financeService.listExpenses(householdId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense by ID' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.financeService.getExpenseById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record new expense' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput
  ) {
    const data = await this.financeService.createExpense(householdId, userId, body);
    return {
      success: true,
      data,
      message: 'Pengeluaran berhasil dicatat',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update expense record' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) body: UpdateExpenseInput
  ) {
    const data = await this.financeService.updateExpense(householdId, id, userId, body);
    return {
      success: true,
      data,
      message: 'Pengeluaran berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete expense record' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.financeService.deleteExpense(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Pengeluaran berhasil dihapus',
    };
  }
}
