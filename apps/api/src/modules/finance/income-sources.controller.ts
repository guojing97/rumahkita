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
  createIncomeSourceSchema,
  updateIncomeSourceSchema,
  CreateIncomeSourceInput,
  UpdateIncomeSourceInput,
} from '@rumahkita/contracts';

@ApiTags('Income Sources')
@Controller('income-sources')
export class IncomeSourcesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  @ApiOperation({ summary: 'List income sources for current household' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query('includeInactive') includeInactive?: string
  ) {
    const data = await this.financeService.listIncomeSources(
      householdId,
      includeInactive === 'true'
    );
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get income source by ID' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.financeService.getIncomeSourceById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new income source' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createIncomeSourceSchema))
    body: CreateIncomeSourceInput
  ) {
    const data = await this.financeService.createIncomeSource(
      householdId,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Sumber pendapatan berhasil dibuat',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update income source' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateIncomeSourceSchema))
    body: UpdateIncomeSourceInput
  ) {
    const data = await this.financeService.updateIncomeSource(
      householdId,
      id,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Sumber pendapatan berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete income source' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.financeService.deleteIncomeSource(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Sumber pendapatan berhasil dihapus',
    };
  }
}
