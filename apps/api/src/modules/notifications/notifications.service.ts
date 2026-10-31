import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';
import { UpdateNotificationPreferenceInput } from '@rumahkita/contracts';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async getPreferences(householdId: string, userId: string) {
    const [existing] = await this.db
      .select()
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.householdId, householdId),
          eq(schema.notificationPreferences.userId, userId)
        )
      );

    if (existing) {
      return existing;
    }

    // Auto-create default
    const [user] = await this.db
      .select({ email: schema.users.email, phoneNumber: schema.users.phoneNumber })
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    const [created] = await this.db
      .insert(schema.notificationPreferences)
      .values({
        householdId,
        userId,
        emailEnabled: true,
        emailAddress: user?.email || null,
        whatsappEnabled: false,
        whatsappNumber: user?.phoneNumber || null,
      })
      .returning();

    return created;
  }

  async updatePreferences(
    householdId: string,
    userId: string,
    input: UpdateNotificationPreferenceInput
  ) {
    const existing = await this.getPreferences(householdId, userId);

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.emailEnabled !== undefined) updateData.emailEnabled = input.emailEnabled;
    if (input.emailAddress !== undefined) updateData.emailAddress = input.emailAddress;
    if (input.whatsappEnabled !== undefined) updateData.whatsappEnabled = input.whatsappEnabled;
    if (input.whatsappNumber !== undefined) updateData.whatsappNumber = input.whatsappNumber;

    const [updated] = await this.db
      .update(schema.notificationPreferences)
      .set(updateData)
      .where(eq(schema.notificationPreferences.id, existing.id))
      .returning();

    return updated;
  }
}
