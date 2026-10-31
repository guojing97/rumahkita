import { z } from 'zod';
import { householdRoleEnum } from '../common/enums.js';

const emailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.string().email('Format email tidak valid')
);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password minimal 8 karakter'),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(100),
  phoneNumber: z.string().max(30).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phoneNumber: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export const householdSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  currency: z.string().default('IDR'),
  timezone: z.string().default('Asia/Jakarta'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Household = z.infer<typeof householdSchema>;

export const householdMemberSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  userId: z.string().uuid(),
  role: householdRoleEnum,
  joinedAt: z.string(),
  user: userProfileSchema.optional(),
});

export type HouseholdMember = z.infer<typeof householdMemberSchema>;

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
  }),
  household: z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: householdRoleEnum,
  }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: householdRoleEnum.default('member'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token reset password wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
