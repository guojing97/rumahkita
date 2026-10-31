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
  createIncomeCategorySchema,
  updateIncomeCategorySchema,
  CreateIncomeCategoryInput,
  UpdateIncomeCategoryInput,
} from '@rumahkita/contracts';

@ApiTags('Income Categories')
@Controller('income-categories')
export class IncomeCategoriesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @ApiOperation({ summary: 'List income categories' })
  async list(@CurrentHouseholdId() householdId: string) {
    const data = await this.financeService.listIncomeCategories(householdId);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get income category by ID' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.financeService.getIncomeCategoryById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create income category' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createIncomeCategorySchema))
    body: CreateIncomeCategoryInput
  ) {
    const data = await this.financeService.createIncomeCategory(
      householdId,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Kategori pemasukan berhasil dibuat',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update income category' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateIncomeCategorySchema))
    body: UpdateIncomeCategoryInput
  ) {
    const data = await this.financeService.updateIncomeCategory(
      householdId,
      id,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Kategori pemasukan berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete income category' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.financeService.deleteIncomeCategory(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Kategori pemasukan berhasil dihapus',
    };
  }
}
