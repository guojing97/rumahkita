import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationPreferencesController } from './notification-preferences.controller.js';

@Module({
  controllers: [NotificationPreferencesController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
