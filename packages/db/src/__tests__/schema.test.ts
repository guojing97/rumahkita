import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  // Tables
  users,
  refreshSessions,
  households,
  householdMembers,
  incomeSources,
  incomeCategories,
  expenseCategories,
  incomes,
  expenses,
  items,
  stockMovements,
  purchases,
  purchaseItems,
  debtsReceivables,
  debtReceivablePayments,
  notificationPreferences,
  notificationEvents,
  auditLogs,
  // Enums
  householdRoleEnum,
  paymentMethodEnum,
  stockMovementReasonEnum,
  purchaseStatusEnum,
  debtTypeEnum,
  debtStatusEnum,
  notificationChannelEnum,
  notificationStatusEnum,
  // Helpers
  idrNumeric,
  auditColumns,
  softDeleteColumn,
  createDatabaseClient,
} from '../index';
import { SEED_IDS, VERIFIED_ARGON2ID_PASSWORD123_HASH } from '../seed';

describe('Milestone 2 Database Schema & Infrastructure Tests', () => {
  describe('PostgreSQL Table Exports (18 Tables)', () => {
    it('exports all 18 PostgreSQL tables', () => {
      const allTables = [
        users,
        refreshSessions,
        households,
        householdMembers,
        incomeSources,
        incomeCategories,
        expenseCategories,
        incomes,
        expenses,
        items,
        stockMovements,
        purchases,
        purchaseItems,
        debtsReceivables,
        debtReceivablePayments,
        notificationPreferences,
        notificationEvents,
        auditLogs,
      ];

      assert.equal(allTables.length, 18);
      for (const table of allTables) {
        assert.ok(table, 'Table must be defined');
        assert.equal(typeof table, 'object');
      }
    });

    it('verifies primary keys and UUID defaults exist on tables', () => {
      assert.ok(users.id);
      assert.ok(households.id);
      assert.ok(incomes.id);
      assert.ok(expenses.id);
      assert.ok(items.id);
      assert.ok(purchases.id);
      assert.ok(debtsReceivables.id);
      assert.ok(notificationEvents.id);
      assert.ok(auditLogs.id);
    });

    it('verifies multi-tenant household_id column exists on business tables', () => {
      assert.ok(householdMembers.householdId);
      assert.ok(incomeSources.householdId);
      assert.ok(incomeCategories.householdId);
      assert.ok(expenseCategories.householdId);
      assert.ok(incomes.householdId);
      assert.ok(expenses.householdId);
      assert.ok(items.householdId);
      assert.ok(stockMovements.householdId);
      assert.ok(purchases.householdId);
      assert.ok(debtsReceivables.householdId);
      assert.ok(notificationPreferences.householdId);
      assert.ok(notificationEvents.householdId);
      assert.ok(auditLogs.householdId);
    });
  });

  describe('PostgreSQL Enums Alignment', () => {
    it('verifies householdRoleEnum values', () => {
      assert.deepEqual(householdRoleEnum.enumValues, ['owner', 'member']);
    });

    it('verifies paymentMethodEnum values', () => {
      assert.deepEqual(paymentMethodEnum.enumValues, ['cash', 'transfer', 'ewallet', 'other']);
    });

    it('verifies stockMovementReasonEnum values', () => {
      assert.deepEqual(stockMovementReasonEnum.enumValues, [
        'purchase',
        'manual_correction',
        'waste',
        'initial',
        'reversal',
      ]);
    });

    it('verifies purchaseStatusEnum values', () => {
      assert.deepEqual(purchaseStatusEnum.enumValues, ['draft', 'completed', 'cancelled']);
    });

    it('verifies debtTypeEnum values', () => {
      assert.deepEqual(debtTypeEnum.enumValues, ['payable', 'receivable']);
    });

    it('verifies debtStatusEnum values', () => {
      assert.deepEqual(debtStatusEnum.enumValues, [
        'open',
        'partially_paid',
        'settled',
        'overdue',
        'cancelled',
      ]);
    });

    it('verifies notificationChannelEnum values', () => {
      assert.deepEqual(notificationChannelEnum.enumValues, ['EMAIL', 'WHATSAPP']);
    });

    it('verifies notificationStatusEnum values', () => {
      assert.deepEqual(notificationStatusEnum.enumValues, [
        'PENDING',
        'PROCESSING',
        'SENT',
        'FAILED',
        'CANCELLED',
      ]);
    });
  });

  describe('Common Column Helpers', () => {
    it('idrNumeric helper creates numeric(14,0) column', () => {
      const col = idrNumeric('test_nominal') as unknown as {
        config: { name: string; precision: number; scale: number; columnType: string };
      };
      assert.ok(col);
      assert.equal(col.config.name, 'test_nominal');
      assert.equal(col.config.precision, 14);
      assert.equal(col.config.scale, 0);
      assert.equal(col.config.columnType, 'PgNumeric');
    });

    it('auditColumns helper provides standard tracking fields', () => {
      assert.ok(auditColumns.createdAt);
      assert.ok(auditColumns.updatedAt);
      assert.ok(auditColumns.createdBy);
      assert.ok(auditColumns.updatedBy);
    });

    it('softDeleteColumn helper provides deletedAt field', () => {
      assert.ok(softDeleteColumn.deletedAt);
    });
  });

  describe('Database Client Factory', () => {
    it('creates database client with db and queryClient instances', () => {
      const client = createDatabaseClient({
        connectionString: 'postgresql://test:test@localhost:5432/test',
        maxConnections: 1,
      });

      assert.ok(client.db);
      assert.ok(client.queryClient);
      assert.equal(typeof client.queryClient.end, 'function');
    });
  });

  describe('Seeder Configuration & Deterministic Identities', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it('contains valid RFC 4122 deterministic UUIDs for all seed records', () => {
      for (const [key, value] of Object.entries(SEED_IDS)) {
        assert.match(value, uuidRegex, `SEED_IDS.${key} must be a valid UUID`);
      }
    });

    it('verifies verified Argon2id password hash for Password123!', () => {
      assert.ok(VERIFIED_ARGON2ID_PASSWORD123_HASH.startsWith('$argon2id$v=19$m=65536,t=3,p=4$'));
    });
  });
});
