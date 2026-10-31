import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT } from '../../common/constants/tokens.js';

@Injectable()
export class HouseholdService {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async getCurrentHousehold(householdId: string) {
    const [household] = await this.db
      .select()
      .from(schema.households)
      .where(eq(schema.households.id, householdId));

    if (!household) {
      throw new NotFoundException('Rumah tangga tidak ditemukan');
    }

    const members = await this.db
      .select({
        id: schema.users.id,
        memberId: schema.householdMembers.id,
        userId: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.householdMembers.role,
        joinedAt: schema.householdMembers.joinedAt,
      })
      .from(schema.householdMembers)
      .innerJoin(
        schema.users,
        eq(schema.householdMembers.userId, schema.users.id)
      )
      .where(eq(schema.householdMembers.householdId, householdId));

    return {
      id: household.id,
      name: household.name,
      currency: household.currency,
      timezone: household.timezone,
      createdAt: household.createdAt,
      updatedAt: household.updatedAt,
      members,
    };
  }

  async getUserHouseholds(userId: string) {
    return await this.db
      .select({
        id: schema.households.id,
        name: schema.households.name,
        currency: schema.households.currency,
        timezone: schema.households.timezone,
        role: schema.householdMembers.role,
        joinedAt: schema.householdMembers.joinedAt,
      })
      .from(schema.householdMembers)
      .innerJoin(
        schema.households,
        eq(schema.householdMembers.householdId, schema.households.id)
      )
      .where(eq(schema.householdMembers.userId, userId));
  }

  async createHousehold(userId: string, input: { name: string; currency?: string; timezone?: string }) {
    return await this.db.transaction(async (tx) => {
      const [household] = await tx
        .insert(schema.households)
        .values({
          name: input.name.trim(),
          currency: input.currency || 'IDR',
          timezone: input.timezone || 'Asia/Jakarta',
        })
        .returning();

      await tx.insert(schema.householdMembers).values({
        householdId: household.id,
        userId,
        role: 'owner',
      });

      return household;
    });
  }

  async updateHousehold(householdId: string, input: { name?: string; currency?: string; timezone?: string }) {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (input.name) updateData.name = input.name.trim();
    if (input.currency) updateData.currency = input.currency.trim();
    if (input.timezone) updateData.timezone = input.timezone.trim();

    const [updated] = await this.db
      .update(schema.households)
      .set(updateData)
      .where(eq(schema.households.id, householdId))
      .returning();

    if (!updated) {
      throw new NotFoundException('Rumah tangga tidak ditemukan');
    }

    return updated;
  }

  async getMembers(householdId: string) {
    return await this.db
      .select({
        id: schema.householdMembers.id,
        householdId: schema.householdMembers.householdId,
        userId: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.householdMembers.role,
        joinedAt: schema.householdMembers.joinedAt,
      })
      .from(schema.householdMembers)
      .innerJoin(
        schema.users,
        eq(schema.householdMembers.userId, schema.users.id)
      )
      .where(eq(schema.householdMembers.householdId, householdId));
  }

  async inviteMember(householdId: string, input: { email: string; role?: 'owner' | 'member' }) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Find user by email
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (!user) {
      throw new NotFoundException('Pengguna dengan email ini tidak ditemukan');
    }

    // 2. Check if already member
    const [existing] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.householdId, householdId),
          eq(schema.householdMembers.userId, user.id)
        )
      );

    if (existing) {
      throw new ConflictException('Pengguna sudah menjadi anggota rumah tangga ini');
    }

    // 3. Add to members
    const [member] = await this.db
      .insert(schema.householdMembers)
      .values({
        householdId,
        userId: user.id,
        role: input.role || 'member',
      })
      .returning();

    return {
      id: member.id,
      householdId: member.householdId,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: member.role,
      joinedAt: member.joinedAt,
    };
  }

  async removeMember(householdId: string, memberId: string) {
    // Find member
    const [member] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.id, memberId),
          eq(schema.householdMembers.householdId, householdId)
        )
      );

    if (!member) {
      throw new NotFoundException('Anggota tidak ditemukan');
    }

    // If owner, check count of owners
    if (member.role === 'owner') {
      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.householdMembers)
        .where(
          and(
            eq(schema.householdMembers.householdId, householdId),
            eq(schema.householdMembers.role, 'owner')
          )
        );

      if (Number(countResult?.count || 0) <= 1) {
        throw new BadRequestException('Tidak dapat menghapus satu-satunya pemilik rumah tangga');
      }
    }

    await this.db
      .delete(schema.householdMembers)
      .where(eq(schema.householdMembers.id, memberId));

    return null;
  }
}
