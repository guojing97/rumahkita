import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  updateNotificationPreferenceSchema,
  UpdateNotificationPreferenceInput,
} from '@rumahkita/contracts';

@ApiTags('Notifications')
@Controller(['settings/notifications', 'notifications/preferences'])
export class NotificationPreferencesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get notification channel preferences' })
  async getPreferences(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string
  ) {
    const data = await this.notificationsService.getPreferences(householdId, userId);
    return {
      success: true,
      data,
    };
  }

  @Put()
  @ApiOperation({ summary: 'Update notification channel preferences' })
  async updatePreferences(
    @CurrentHouseholdId() householdId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(updateNotificationPreferenceSchema))
    body: UpdateNotificationPreferenceInput
  ) {
    const data = await this.notificationsService.updatePreferences(
      householdId,
      userId,
      body
    );
    return {
      success: true,
      data,
      message: 'Preferensi notifikasi berhasil diperbarui',
    };
  }
}
