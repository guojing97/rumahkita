import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FinanceService } from './finance.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '@rumahkita/contracts';

@ApiTags('Expense Categories')
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @ApiOperation({ summary: 'List expense categories' })
  async list(@CurrentHouseholdId() householdId: string) {
    const data = await this.financeService.listExpenseCategories(householdId);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get expense category by ID' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.financeService.getExpenseCategoryById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create expense category' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createExpenseCategorySchema))
    body: CreateExpenseCategoryInput
  ) {
    const data = await this.financeService.createExpenseCategory(
      householdId,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Kategori pengeluaran berhasil dibuat',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update expense category' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateExpenseCategorySchema))
    body: UpdateExpenseCategoryInput
  ) {
    const data = await this.financeService.updateExpenseCategory(
      householdId,
      id,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Kategori pengeluaran berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete expense category' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.financeService.deleteExpenseCategory(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Kategori pengeluaran berhasil dihapus',
    };
  }
}
