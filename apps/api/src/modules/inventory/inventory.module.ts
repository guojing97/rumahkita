import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { ItemsController } from './items.controller.js';

@Module({
  controllers: [ItemsController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
