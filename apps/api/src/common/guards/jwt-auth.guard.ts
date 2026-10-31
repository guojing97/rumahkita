import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { eq, and } from 'drizzle-orm';
import * as schema from '@rumahkita/db';
import type { DbClient } from '@rumahkita/db';
import { IS_PUBLIC_KEY, DB_CLIENT } from '../constants/tokens.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
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
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token otentikasi tidak ditemukan');
    }

    const token = authHeader.split(' ')[1]?.trim();
    if (!token) {
      throw new UnauthorizedException('Token otentikasi tidak ditemukan');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'rumahkita_super_secret_jwt_key_2026',
      });
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token telah kedaluwarsa');
      }
      throw new UnauthorizedException('Token tidak valid');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Token tidak valid');
    }

    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(and(eq(schema.users.id, payload.sub), eq(schema.users.isActive, true)));

    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan atau tidak aktif');
    }

    (request as any).user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    };

    return true;
  }
}
