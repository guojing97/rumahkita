import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createPurchaseSchema,
  purchaseQuerySchema,
  cancelPurchaseSchema,
  CreatePurchaseInput,
  PurchaseQuery,
  CancelPurchaseInput,
} from '@rumahkita/contracts';

@ApiTags('Purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @ApiOperation({ summary: 'List and filter purchases' })
  async list(
    @CurrentHouseholdId() householdId: string,
    @Query(new ZodValidationPipe(purchaseQuerySchema)) query: PurchaseQuery
  ) {
    const result = await this.purchasesService.listPurchases(householdId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase by ID with items' })
  async getById(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string
  ) {
    const data = await this.purchasesService.getPurchaseById(householdId, id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase draft' })
  async create(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createPurchaseSchema)) body: CreatePurchaseInput
  ) {
    const data = await this.purchasesService.createPurchase(householdId, userId, body);
    return {
      success: true,
      data,
      message: 'Draf pembelian berhasil dibuat',
    };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atomically complete purchase, creating expense and updating stock' })
  async complete(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
    @Body('idempotencyKey') idempotencyKeyBody?: string
  ) {
    const key = idempotencyKeyHeader || idempotencyKeyBody;
    const data = await this.purchasesService.completePurchase(
      householdId,
      id,
      userId,
      key
    );
    return {
      success: true,
      data,
      message: 'Pembelian berhasil diselesaikan',
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel purchase draft' })
  async cancel(
    @CurrentHouseholdId() householdId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(cancelPurchaseSchema)) body: CancelPurchaseInput
  ) {
    const data = await this.purchasesService.cancelPurchase(
      householdId,
      id,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Pembelian berhasil dibatalkan',
    };
  }
}
