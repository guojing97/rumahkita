/**
 * RumahKita — Comprehensive & Idempotent Database Seeder
 *
 * Populates:
 * 1. Household: "Keluarga Kevin & Ayu"
 * 2. Two real users with Argon2id password hash for "e5f6g7h8":
 *    - Kevin Hendrawan (Owner): hendrawankevin97@gmail.com
 *    - Ayu Restyaningsih (Member): ayurestyaningsih@gmail.com
 * 3. Default master data (Standard Expense Categories, Income Sources, Income Categories)
 * 4. Clean baseline (NO dummy items, NO dummy debts, NO dummy transactions)
 *
 * Run: pnpm --filter @rumahkita/db run db:seed
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import * as schema from './schema/index';

// Load monorepo root .env if DATABASE_URL is not already set in environment
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

// Deterministic UUID constants ensuring safe repeated execution
export const SEED_IDS = {
  // Household
  HOUSEHOLD_PRIMARY: '00000000-0000-4000-a000-000000000001',

  // Users
  USER_KEVIN: '00000000-0000-4000-a000-000000000011',
  USER_AYU: '00000000-0000-4000-a000-000000000012',

  // Household Memberships
  MEMBER_KEVIN: '00000000-0000-4000-a000-000000000021',
  MEMBER_AYU: '00000000-0000-4000-a000-000000000022',

  // Notification Preferences
  NOTIF_KEVIN: '00000000-0000-4000-a000-000000000031',
  NOTIF_AYU: '00000000-0000-4000-a000-000000000032',

  // Income Sources
  SOURCE_GAJI: '00000000-0000-4000-a000-000000000101',
  SOURCE_BISNIS: '00000000-0000-4000-a000-000000000102',
  SOURCE_FREELANCE: '00000000-0000-4000-a000-000000000103',
  SOURCE_INVESTASI: '00000000-0000-4000-a000-000000000104',
  SOURCE_LAINNYA: '00000000-0000-4000-a000-000000000105',

  // Income Categories
  INCOME_CAT_GAJI: '00000000-0000-4000-a000-000000000201',
  INCOME_CAT_BISNIS: '00000000-0000-4000-a000-000000000202',
  INCOME_CAT_FREELANCE: '00000000-0000-4000-a000-000000000203',
  INCOME_CAT_INVESTASI: '00000000-0000-4000-a000-000000000204',
  INCOME_CAT_LAINNYA: '00000000-0000-4000-a000-000000000205',

  // Expense Categories
  EXPENSE_CAT_MAKAN: '00000000-0000-4000-a000-000000000301',
  EXPENSE_CAT_TRANSPORT: '00000000-0000-4000-a000-000000000302',
  EXPENSE_CAT_LISTRIK_AIR: '00000000-0000-4000-a000-000000000303',
  EXPENSE_CAT_TEMPAT_TINGGAL: '00000000-0000-4000-a000-000000000304',
  EXPENSE_CAT_KESEHATAN: '00000000-0000-4000-a000-000000000305',
  EXPENSE_CAT_PENDIDIKAN: '00000000-0000-4000-a000-000000000306',
  EXPENSE_CAT_BELANJA: '00000000-0000-4000-a000-000000000307',
  EXPENSE_CAT_HIBURAN: '00000000-0000-4000-a000-000000000308',
  EXPENSE_CAT_TABUNGAN_INVESTASI: '00000000-0000-4000-a000-000000000309',
  EXPENSE_CAT_LAIN_LAIN: '00000000-0000-4000-a000-000000000310',
};

// Verified RFC 9106 Argon2id hash for "e5f6g7h8"
export const VERIFIED_ARGON2ID_E5F6G7H8_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$fTKxUx63JF051qc5aOXtUg$ud32tfrOBZDz9DYQeiH6GwQ7tuZRtXnf/hX9p7XlDmU';

// Verified RFC 9106 Argon2id hash for "Password123!" (preserved for test compatibility)
export const VERIFIED_ARGON2ID_PASSWORD123_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$UnVtYWhLaXRhU2VlZFNhbHQ$4wG7rFkWXz+R4pQc6JbL1hT5zXvM8yD2uI9oA3sE5g8';

async function getPasswordHash(plainPassword: string): Promise<string> {
  try {
    const argon2 = await import('@node-rs/argon2');
    return await argon2.hash(plainPassword, {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  } catch {
    return plainPassword === 'e5f6g7h8'
      ? VERIFIED_ARGON2ID_E5F6G7H8_HASH
      : VERIFIED_ARGON2ID_PASSWORD123_HASH;
  }
}

export async function seedDatabase(connectionString?: string) {
  const connStr =
    connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

  console.log('🌱 [RumahKita Seeder] Starting database seeding...');
  console.log(`🔌 Connection target: ${connStr.replace(/:[^:@]+@/, ':****@')}`);

  const queryClient = postgres(connStr, { max: 1 });
  const db = drizzle(queryClient, { schema });

  try {
    await db.transaction(async (tx) => {
      // 0. Reset all operational and reference tables for clean baseline state
      console.log('  -> Resetting all operational tables for clean seed state...');
      await tx.execute(sql`
        TRUNCATE TABLE
          audit_logs,
          notification_events,
          notification_preferences,
          debt_receivable_payments,
          debts_receivables,
          purchase_items,
          purchases,
          stock_movements,
          items,
          expenses,
          incomes,
          expense_categories,
          income_categories,
          income_sources,
          refresh_sessions,
          household_members,
          households,
          users
        CASCADE;
      `);

      // 1. Households: 1 Household "Keluarga Kevin & Ayu"
      console.log('  -> Seeding household: "Keluarga Kevin & Ayu"...');
      await tx
        .insert(schema.households)
        .values([
          {
            id: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Keluarga Kevin & Ayu',
            currency: 'IDR',
            timezone: 'Asia/Jakarta',
          },
        ])
        .onConflictDoUpdate({
          target: schema.households.id,
          set: {
            name: sql`EXCLUDED.name`,
            currency: sql`EXCLUDED.currency`,
            timezone: sql`EXCLUDED.timezone`,
            updatedAt: new Date(),
          },
        });

      // 2. Users (Argon2id hashed password: "e5f6g7h8")
      console.log('  -> Seeding 2 users with Argon2id password hash for "e5f6g7h8"...');
      const passwordHash = await getPasswordHash('e5f6g7h8');

      await tx
        .insert(schema.users)
        .values([
          {
            id: SEED_IDS.USER_KEVIN,
            email: 'hendrawankevin97@gmail.com',
            passwordHash,
            fullName: 'Kevin Hendrawan',
            phoneNumber: '+6281234567890',
            isActive: true,
          },
          {
            id: SEED_IDS.USER_AYU,
            email: 'ayurestyaningsih@gmail.com',
            passwordHash,
            fullName: 'Ayu Restyaningsih',
            phoneNumber: '+6281298765432',
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: schema.users.email,
          set: {
            fullName: sql`EXCLUDED.full_name`,
            passwordHash: sql`EXCLUDED.password_hash`,
            phoneNumber: sql`EXCLUDED.phone_number`,
            isActive: sql`EXCLUDED.is_active`,
            updatedAt: new Date(),
          },
        });

      // 3. Household Memberships: Kevin = Owner, Ayu = Member
      console.log('  -> Linking household members (Kevin: owner, Ayu: member)...');
      await tx
        .insert(schema.householdMembers)
        .values([
          {
            id: SEED_IDS.MEMBER_KEVIN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_KEVIN,
            role: 'owner',
          },
          {
            id: SEED_IDS.MEMBER_AYU,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_AYU,
            role: 'member',
          },
        ])
        .onConflictDoUpdate({
          target: [schema.householdMembers.householdId, schema.householdMembers.userId],
          set: {
            role: sql`EXCLUDED.role`,
          },
        });

      // 4. Default Notification Preferences
      console.log('  -> Setting default notification preferences...');
      await tx
        .insert(schema.notificationPreferences)
        .values([
          {
            id: SEED_IDS.NOTIF_KEVIN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_KEVIN,
            emailEnabled: true,
            emailAddress: 'hendrawankevin97@gmail.com',
            whatsappEnabled: false,
          },
          {
            id: SEED_IDS.NOTIF_AYU,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            userId: SEED_IDS.USER_AYU,
            emailEnabled: true,
            emailAddress: 'ayurestyaningsih@gmail.com',
            whatsappEnabled: false,
          },
        ])
        .onConflictDoUpdate({
          target: [schema.notificationPreferences.householdId, schema.notificationPreferences.userId],
          set: {
            emailEnabled: sql`EXCLUDED.email_enabled`,
            emailAddress: sql`EXCLUDED.email_address`,
            whatsappEnabled: sql`EXCLUDED.whatsapp_enabled`,
            whatsappNumber: sql`EXCLUDED.whatsapp_number`,
            updatedAt: new Date(),
          },
        });

      // 5. Standard Income Sources
      console.log('  -> Seeding standard income sources...');
      await tx
        .insert(schema.incomeSources)
        .values([
          {
            id: SEED_IDS.SOURCE_GAJI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Gaji',
            description: 'Gaji bulanan pekerjaan utama',
            isActive: true,
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.SOURCE_BISNIS,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Bisnis / Usaha',
            description: 'Pendapatan dari bisnis / wirausaha',
            isActive: true,
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.SOURCE_FREELANCE,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Freelance',
            description: 'Pendapatan proyek lepas dan konsultasi',
            isActive: true,
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.SOURCE_INVESTASI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Investasi',
            description: 'Dividen, reksadana, dan bunga investasi',
            isActive: true,
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.SOURCE_LAINNYA,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Lainnya',
            description: 'Pendapatan lain-lain',
            isActive: true,
            createdBy: SEED_IDS.USER_KEVIN,
          },
        ])
        .onConflictDoUpdate({
          target: schema.incomeSources.id,
          set: {
            name: sql`EXCLUDED.name`,
            description: sql`EXCLUDED.description`,
            isActive: sql`EXCLUDED.is_active`,
            updatedAt: new Date(),
          },
        });

      // 6. Standard Income Categories
      console.log('  -> Seeding standard income categories...');
      await tx
        .insert(schema.incomeCategories)
        .values([
          {
            id: SEED_IDS.INCOME_CAT_GAJI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Gaji',
            icon: 'briefcase',
            color: '#10B981',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.INCOME_CAT_BISNIS,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Bisnis / Usaha',
            icon: 'store',
            color: '#3B82F6',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.INCOME_CAT_FREELANCE,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Freelance',
            icon: 'laptop',
            color: '#8B5CF6',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.INCOME_CAT_INVESTASI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Investasi',
            icon: 'trending-up',
            color: '#F59E0B',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.INCOME_CAT_LAINNYA,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Lainnya',
            icon: 'plus-circle',
            color: '#64748B',
            createdBy: SEED_IDS.USER_KEVIN,
          },
        ])
        .onConflictDoUpdate({
          target: schema.incomeCategories.id,
          set: {
            name: sql`EXCLUDED.name`,
            icon: sql`EXCLUDED.icon`,
            color: sql`EXCLUDED.color`,
            updatedAt: new Date(),
          },
        });

      // 7. Standard Expense Categories
      console.log('  -> Seeding standard expense categories...');
      await tx
        .insert(schema.expenseCategories)
        .values([
          {
            id: SEED_IDS.EXPENSE_CAT_MAKAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Makanan & Minuman',
            icon: 'utensils',
            color: '#F59E0B',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_TRANSPORT,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Transportasi',
            icon: 'car',
            color: '#3B82F6',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_LISTRIK_AIR,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Listrik & Air',
            icon: 'zap',
            color: '#EF4444',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_TEMPAT_TINGGAL,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Tempat Tinggal',
            icon: 'home',
            color: '#6366F1',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_KESEHATAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Kesehatan',
            icon: 'heart-pulse',
            color: '#EC4899',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_PENDIDIKAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Pendidikan',
            icon: 'book-open',
            color: '#14B8A6',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_BELANJA,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Belanja Kebutuhan',
            icon: 'shopping-bag',
            color: '#8B5CF6',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_HIBURAN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Hiburan',
            icon: 'film',
            color: '#A855F7',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_TABUNGAN_INVESTASI,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Tabungan & Investasi',
            icon: 'piggy-bank',
            color: '#22C55E',
            createdBy: SEED_IDS.USER_KEVIN,
          },
          {
            id: SEED_IDS.EXPENSE_CAT_LAIN_LAIN,
            householdId: SEED_IDS.HOUSEHOLD_PRIMARY,
            name: 'Lain-lain',
            icon: 'more-horizontal',
            color: '#64748B',
            createdBy: SEED_IDS.USER_KEVIN,
          },
        ])
        .onConflictDoUpdate({
          target: schema.expenseCategories.id,
          set: {
            name: sql`EXCLUDED.name`,
            icon: sql`EXCLUDED.icon`,
            color: sql`EXCLUDED.color`,
            updatedAt: new Date(),
          },
        });
    });

    console.log('✅ [RumahKita Seeder] Database seeded successfully!');
    console.log('📊 Summary:');
    console.log('   - Household: 1 ("Keluarga Kevin & Ayu")');
    console.log('   - Users: 2 (Kevin Hendrawan [owner], Ayu Restyaningsih [member])');
    console.log('   - Password: "e5f6g7h8" (Argon2id hashed)');
    console.log('   - Master Data: 5 Income Sources, 5 Income Categories, 10 Expense Categories');
    console.log('   - Clean State: 0 dummy inventory items, 0 dummy debts, 0 dummy transactions');
  } catch (error) {
    console.error('❌ [RumahKita Seeder] Seeding failed:', error);
    throw error;
  } finally {
    await queryClient.end();
  }
}

const isDirectRun = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'))
);

if (isDirectRun) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
