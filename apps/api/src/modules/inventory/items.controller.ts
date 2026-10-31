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
import { InventoryService } from './inventory.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createItemSchema,
  updateItemSchema,
  itemQuerySchema,
  stockAdjustmentSchema,
  CreateItemInput,
  UpdateItemInput,
  ItemQuery,
  StockAdjustmentInput,
} from '@rumahkita/contracts';

@ApiTags('Inventory')
@Controller('items')
export class ItemsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter inventory items with stock status' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(itemQuerySchema)) query: ItemQuery
  ) {
    const result = await this.inventoryService.listItems(householdId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by ID with stock status' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.inventoryService.getItemById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new inventory item' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput
  ) {
    const data = await this.inventoryService.createItem(householdId, userId, body);
    return {
      success: true,
      data,
      message: 'Barang berhasil ditambahkan',
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update inventory item' })
  async update(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemInput
  ) {
    const data = await this.inventoryService.updateItem(householdId, id, userId, body);
    return {
      success: true,
      data,
      message: 'Barang berhasil diperbarui',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete inventory item' })
  async delete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string
  ) {
    await this.inventoryService.deleteItem(householdId, id, userId);
    return {
      success: true,
      data: null,
      message: 'Barang berhasil dihapus',
    };
  }

  @Post([':id/stock-adjustments', ':id/adjust'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually adjust item stock with reason' })
  async adjustStock(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(stockAdjustmentSchema)) body: StockAdjustmentInput
  ) {
    const data = await this.inventoryService.adjustStock(householdId, id, userId, body);
    return {
      success: true,
      data,
      message: 'Stok barang berhasil disesuaikan',
    };
  }

  @Get(':id/stock-adjustments')
  @ApiOperation({ summary: 'Get stock adjustment movements history for item' })
  async getStockAdjustments(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.inventoryService.getStockAdjustments(householdId, id);
    return {
      success: true,
      data,
    };
  }
}
