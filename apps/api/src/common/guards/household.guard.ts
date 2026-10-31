import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { eq, and } from 'drizzle-orm';
import * as schema from '@rumahkita/db';
import type { DbClient } from '@rumahkita/db';
import { IS_PUBLIC_KEY, DB_CLIENT } from '../constants/tokens.js';

@Injectable()
export class HouseholdGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB_CLIENT) private readonly db: DbClient
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user) {
      return true;
    }

    // 1. Resolve targeted household ID from header, route params, or fallback
    const headerHId = request.headers['x-household-id'] as string | undefined;
    const paramHId =
      request.params?.householdId ||
      (request.baseUrl.includes('households') ? request.params?.id : undefined);
    const queryHId = request.query?.householdId as string | undefined;

    let targetHouseholdId = headerHId || paramHId || queryHId;

    if (!targetHouseholdId) {
      // Find all memberships for current user
      const userMemberships = await this.db
        .select({
          householdId: schema.householdMembers.householdId,
          role: schema.householdMembers.role,
        })
        .from(schema.householdMembers)
        .where(eq(schema.householdMembers.userId, user.id));

      if (userMemberships.length === 0) {
        throw new ForbiddenException(
          'Pengguna tidak memiliki akses ke rumah tangga manapun'
        );
      }

      // Default to owner membership if available, else first
      const primary =
        userMemberships.find((m) => m.role === 'owner') || userMemberships[0];
      targetHouseholdId = primary!.householdId;
    }

    // 2. Verify membership in targeted household
    const [membership] = await this.db
      .select({
        householdId: schema.householdMembers.householdId,
        role: schema.householdMembers.role,
        householdName: schema.households.name,
        currency: schema.households.currency,
        timezone: schema.households.timezone,
      })
      .from(schema.householdMembers)
      .innerJoin(
        schema.households,
        eq(schema.householdMembers.householdId, schema.households.id)
      )
      .where(
        and(
          eq(schema.householdMembers.householdId, targetHouseholdId),
          eq(schema.householdMembers.userId, user.id)
        )
      );

    if (!membership) {
      throw new ForbiddenException('Akses ke data rumah tangga ini ditolak');
    }

    (request as any).household = {
      id: membership.householdId,
      role: membership.role,
      name: membership.householdName,
      currency: membership.currency,
      timezone: membership.timezone,
    };

    return true;
  }
}
