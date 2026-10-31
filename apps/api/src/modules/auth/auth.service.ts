import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { Response, Request } from 'express';
import { eq, and } from 'drizzle-orm';
import { schema, DbClient } from '@rumahkita/db';
import { DB_CLIENT, REFRESH_COOKIE_NAME } from '../../common/constants/tokens.js';
import { LoginThrottleService } from './login-throttle.service.js';

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

const DUMMY_ARGON2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$Gd9byQV+bvaOnSUFF2xuJA$GOXi2toGqoznGqHCpUsBzkZpF7/NAC3VehyY8cYlCNw';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_CLIENT) private readonly db: DbClient,
    private readonly jwtService: JwtService,
    private readonly loginThrottleService: LoginThrottleService
  ) {}

  private throwThrottledException(res: Response, remainingSeconds: number): never {
    if (typeof res?.setHeader === 'function') {
      res.setHeader('Retry-After', String(remainingSeconds));
    } else if (typeof (res as any)?.set === 'function') {
      (res as any).set('Retry-After', String(remainingSeconds));
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${remainingSeconds} detik.`,
        retryAfter: remainingSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private handleLoginFailure(normalizedEmail: string, res: Response): never {
    const failure = this.loginThrottleService.recordFailure(normalizedEmail);
    if (failure.isLocked) {
      this.throwThrottledException(res, failure.remainingSeconds);
    }
    throw new UnauthorizedException('Email atau password salah');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  public setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  public clearRefreshCookie(res: Response): void {
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    };
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
  }

  public generateAccessToken(user: { id: string; email: string }): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: process.env.JWT_SECRET || 'rumahkita_super_secret_jwt_key_2026',
        expiresIn: '15m',
      }
    );
  }

  async register(input: RegisterDto, res: Response, req: Request) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Check existing user
    const [existing] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }

    // 2. Hash password with Argon2id
    const passwordHash = await hash(input.password, {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // 3. Atomically create User, Default Household, and Membership
    return await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({
          email: normalizedEmail,
          passwordHash,
          fullName: input.fullName.trim(),
          phoneNumber: input.phoneNumber?.trim() || null,
          isActive: true,
        })
        .returning();

      const [household] = await tx
        .insert(schema.households)
        .values({
          name: `Keluarga ${input.fullName.trim()}`,
          currency: 'IDR',
          timezone: 'Asia/Jakarta',
        })
        .returning();

      await tx.insert(schema.householdMembers).values({
        householdId: household.id,
        userId: user.id,
        role: 'owner',
      });

      // Default notification preference
      await tx.insert(schema.notificationPreferences).values({
        householdId: household.id,
        userId: user.id,
        emailEnabled: true,
        emailAddress: user.email,
        whatsappEnabled: false,
      });

      // Generate sessions & tokens
      const accessToken = this.generateAccessToken(user);
      const rawRefreshToken = randomBytes(32).toString('hex');
      const familyId = randomUUID();
      const tokenHash = this.hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.insert(schema.refreshSessions).values({
        userId: user.id,
        familyId,
        tokenHash,
        isRevoked: false,
        expiresAt,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
      });

      this.setRefreshCookie(res, rawRefreshToken);

      return {
        accessToken,
        expiresIn: 900,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        household: {
          id: household.id,
          name: household.name,
          role: 'owner',
        },
      };
    });
  }

  async login(input: LoginDto, res: Response, req: Request) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 0. Check throttle status
    const throttleStatus = this.loginThrottleService.checkThrottle(normalizedEmail);
    if (throttleStatus.isLocked) {
      this.throwThrottledException(res, throttleStatus.remainingSeconds);
    }

    // 1. Find user
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (!user) {
      // Mitigate side-channel timing attacks by performing a dummy Argon2 verification
      await verify(DUMMY_ARGON2_HASH, input.password).catch(() => false);
      this.handleLoginFailure(normalizedEmail, res);
    }

    // 2. Verify Argon2id password first to mitigate account status enumeration & throttle bypass
    let passwordValid = false;
    try {
      passwordValid = await verify(user.passwordHash, input.password);
    } catch {
      passwordValid = false;
    }

    if (!passwordValid) {
      this.handleLoginFailure(normalizedEmail, res);
    }

    // 3. Check account activation only after password verification succeeds
    if (!user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif atau dinonaktifkan');
    }

    // Login successful -> reset throttle counter
    this.loginThrottleService.reset(normalizedEmail);

    // 3. Find user's households
    const memberships = await this.db
      .select({
        id: schema.households.id,
        name: schema.households.name,
        role: schema.householdMembers.role,
      })
      .from(schema.householdMembers)
      .innerJoin(
        schema.households,
        eq(schema.householdMembers.householdId, schema.households.id)
      )
      .where(eq(schema.householdMembers.userId, user.id));

    let activeHousehold =
      memberships.find((m) => m.role === 'owner') || memberships[0];

    if (!activeHousehold) {
      // Auto-provision if user somehow has no household
      activeHousehold = await this.db.transaction(async (tx) => {
        const [h] = await tx
          .insert(schema.households)
          .values({
            name: `Keluarga ${user.fullName}`,
            currency: 'IDR',
            timezone: 'Asia/Jakarta',
          })
          .returning();

        await tx.insert(schema.householdMembers).values({
          householdId: h.id,
          userId: user.id,
          role: 'owner',
        });

        return { id: h.id, name: h.name, role: 'owner' as const };
      });
      memberships.push(activeHousehold);
    }

    // 4. Issue access token
    const accessToken = this.generateAccessToken({ id: user.id, email: user.email });

    // 5. Issue refresh token
    const rawRefreshToken = randomBytes(32).toString('hex');
    const familyId = randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db.insert(schema.refreshSessions).values({
      userId: user.id,
      familyId,
      tokenHash,
      isRevoked: false,
      expiresAt,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
    });

    this.setRefreshCookie(res, rawRefreshToken);

    return {
      accessToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      household: {
        id: activeHousehold.id,
        name: activeHousehold.name,
        role: activeHousehold.role,
      },
      households: memberships.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
      })),
    };
  }

  async refresh(req: Request, res: Response) {
    const rawRefreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.cookies?.['refresh_token'];

    if (!rawRefreshToken) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    // Find session
    const [session] = await this.db
      .select()
      .from(schema.refreshSessions)
      .where(eq(schema.refreshSessions.tokenHash, tokenHash));

    if (!session) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Sesi tidak valid');
    }

    // Token reuse detection: if already revoked -> revoke whole family!
    if (session.isRevoked) {
      await this.db
        .update(schema.refreshSessions)
        .set({ isRevoked: true })
        .where(eq(schema.refreshSessions.familyId, session.familyId));

      this.clearRefreshCookie(res);
      throw new UnauthorizedException(
        'Terdeteksi penggunaan token tidak sah. Sesi dibatalkan.'
      );
    }

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      await this.db
        .update(schema.refreshSessions)
        .set({ isRevoked: true })
        .where(eq(schema.refreshSessions.id, session.id));

      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Sesi telah kedaluwarsa');
    }

    // Check user active
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, session.userId), eq(schema.users.isActive, true)));

    if (!user) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Pengguna tidak ditemukan atau tidak aktif');
    }

    // Rotate within the same family
    const newRefreshToken = randomBytes(32).toString('hex');
    const newTokenHash = this.hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db.transaction(async (tx) => {
      // Revoke old session
      await tx
        .update(schema.refreshSessions)
        .set({ isRevoked: true })
        .where(eq(schema.refreshSessions.id, session.id));

      // Insert new session with same familyId
      await tx.insert(schema.refreshSessions).values({
        userId: user.id,
        familyId: session.familyId,
        tokenHash: newTokenHash,
        isRevoked: false,
        expiresAt: newExpiresAt,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
      });
    });

    const accessToken = this.generateAccessToken({ id: user.id, email: user.email });
    this.setRefreshCookie(res, newRefreshToken);

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  async logout(req: Request, res: Response) {
    const rawRefreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.cookies?.['refresh_token'];

    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.db
        .update(schema.refreshSessions)
        .set({ isRevoked: true })
        .where(eq(schema.refreshSessions.tokenHash, tokenHash));
    }

    this.clearRefreshCookie(res);
    return null;
  }

  async logoutAll(userId: string, res: Response) {
    await this.db
      .update(schema.refreshSessions)
      .set({ isRevoked: true })
      .where(eq(schema.refreshSessions.userId, userId));

    this.clearRefreshCookie(res);
    return null;
  }

  async getMe(userId: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        phoneNumber: schema.users.phoneNumber,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan');
    }

    const memberships = await this.db
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

    return {
      user,
      households: memberships,
    };
  }

  async forgotPassword(_email: string) {
    // Return generic success without leaking existence
    return null;
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword || newPassword.length < 8) {
      throw new BadRequestException('Token atau password tidak valid');
    }
    return null;
  }
}
