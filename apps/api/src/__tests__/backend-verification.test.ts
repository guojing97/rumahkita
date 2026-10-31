import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { schema, createDatabaseClient } from '@rumahkita/db';
import { itemQuerySchema, transactionQuerySchema } from '@rumahkita/contracts';
import { InventoryService } from '../modules/inventory/inventory.service.js';
import { FinanceService } from '../modules/finance/finance.service.js';

describe('Backend Verification Tests', () => {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://rumahkita:rumahkita_dev_password@localhost:5432/rumahkita';

  let dbClient: ReturnType<typeof createDatabaseClient>;
  let db: ReturnType<typeof createDatabaseClient>['db'];
  let inventoryService: InventoryService;
  let financeService: FinanceService;

  before(async () => {
    dbClient = createDatabaseClient({ connectionString, maxConnections: 2 });
    db = dbClient.db;
    inventoryService = new InventoryService(db);
    financeService = new FinanceService(db);
  });

  after(async () => {
    await dbClient.queryClient.end();
  });

  describe('1. Database Seeder & Account Verification', () => {
    it('seeds exactly 1 household: Keluarga Kevin & Ayu', async () => {
      const households = await db.select().from(schema.households);
      assert.equal(households.length, 1);
      assert.equal(households[0]!.name, 'Keluarga Kevin & Ayu');
      assert.equal(households[0]!.currency, 'IDR');
      assert.equal(households[0]!.timezone, 'Asia/Jakarta');
    });

    it('seeds exactly 2 users with correct roles and Argon2id hash for "e5f6g7h8"', async () => {
      const users = await db.select().from(schema.users).orderBy(schema.users.email);
      assert.equal(users.length, 2);

      const ayu = users.find((u) => u.email === 'ayurestyaningsih@gmail.com');
      const kevin = users.find((u) => u.email === 'hendrawankevin97@gmail.com');

      assert.ok(ayu, 'Ayu must exist');
      assert.ok(kevin, 'Kevin must exist');

      assert.equal(ayu.fullName, 'Ayu Restyaningsih');
      assert.equal(kevin.fullName, 'Kevin Hendrawan');

      // Verify Argon2id passwords
      const ayuValid = await verify(ayu.passwordHash, 'e5f6g7h8');
      const kevinValid = await verify(kevin.passwordHash, 'e5f6g7h8');
      assert.equal(ayuValid, true, 'Ayu password must verify');
      assert.equal(kevinValid, true, 'Kevin password must verify');

      // Verify household members roles
      const members = await db.select().from(schema.householdMembers);
      assert.equal(members.length, 2);

      const kevinMember = members.find((m) => m.userId === kevin.id);
      const ayuMember = members.find((m) => m.userId === ayu.id);

      assert.equal(kevinMember?.role, 'owner');
      assert.equal(ayuMember?.role, 'member');
    });

    it('seeds master categories and zero dummy operational data', async () => {
      const expCats = await db.select().from(schema.expenseCategories);
      const incCats = await db.select().from(schema.incomeCategories);
      const incSrcs = await db.select().from(schema.incomeSources);

      assert.equal(expCats.length, 10, 'Must have 10 standard expense categories');
      assert.equal(incCats.length, 5, 'Must have 5 standard income categories');
      assert.equal(incSrcs.length, 5, 'Must have 5 standard income sources');

      const items = await db.select().from(schema.items);
      const debts = await db.select().from(schema.debtsReceivables);
      const incomes = await db.select().from(schema.incomes);
      const expenses = await db.select().from(schema.expenses);

      assert.equal(items.length, 0, 'Must have 0 dummy items');
      assert.equal(debts.length, 0, 'Must have 0 dummy debts');
      assert.equal(incomes.length, 0, 'Must have 0 dummy incomes');
      assert.equal(expenses.length, 0, 'Must have 0 dummy expenses');
    });
  });

  describe('2. Inventory SQL Status Filter & Pagination', () => {
    let householdId: string;
    let userId: string;

    before(async () => {
      const [hh] = await db.select().from(schema.households);
      householdId = hh!.id;
      const [u] = await db.select().from(schema.users);
      userId = u!.id;

      // Insert 3 test items: 1 SAFE, 1 LOW, 1 OUT
      await db.insert(schema.items).values([
        {
          householdId,
          name: 'Beras Test (Safe)',
          category: 'Sembako',
          unit: 'kg',
          quantityOnHand: 10,
          lowStockThreshold: 3,
          createdBy: userId,
        },
        {
          householdId,
          name: 'Minyak Test (Low)',
          category: 'Sembako',
          unit: 'liter',
          quantityOnHand: 2,
          lowStockThreshold: 2,
          createdBy: userId,
        },
        {
          householdId,
          name: 'Gula Test (Out)',
          category: 'Sembako',
          unit: 'kg',
          quantityOnHand: 0,
          lowStockThreshold: 1,
          createdBy: userId,
        },
      ]);
    });

    after(async () => {
      // Clean up test items
      await db.delete(schema.items).where(eq(schema.items.householdId, householdId));
    });

    it('filters status SAFE directly in SQL with synchronized count metadata', async () => {
      const query = itemQuerySchema.parse({ status: 'SAFE', page: 1, limit: 10 });
      const res = await inventoryService.listItems(householdId, query);
      assert.equal(res.meta.total, 1);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0]!.name, 'Beras Test (Safe)');
      assert.equal(res.data[0]!.status, 'Aman');
    });

    it('filters status LOW directly in SQL with synchronized count metadata', async () => {
      const query = itemQuerySchema.parse({ status: 'LOW', page: 1, limit: 10 });
      const res = await inventoryService.listItems(householdId, query);
      assert.equal(res.meta.total, 1);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0]!.name, 'Minyak Test (Low)');
      assert.equal(res.data[0]!.status, 'Menipis');
    });

    it('filters status OUT directly in SQL with synchronized count metadata', async () => {
      const query = itemQuerySchema.parse({ status: 'OUT', page: 1, limit: 10 });
      const res = await inventoryService.listItems(householdId, query);
      assert.equal(res.meta.total, 1);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0]!.name, 'Gula Test (Out)');
      assert.equal(res.data[0]!.status, 'Habis');
    });

    it('returns all items when status is "all" or omitted', async () => {
      const query = itemQuerySchema.parse({ status: 'all', page: 1, limit: 10 });
      const res = await inventoryService.listItems(householdId, query);
      assert.equal(res.meta.total, 3);
      assert.equal(res.data.length, 3);
    });
  });

  describe('3. Unified /transactions Endpoint Implementation', () => {
    let householdId: string;
    let userId: string;
    let incomeCatId: string;
    let expenseCatId: string;
    let sourceId: string;

    before(async () => {
      const [hh] = await db.select().from(schema.households);
      householdId = hh!.id;
      const [u] = await db.select().from(schema.users);
      userId = u!.id;

      const [incCat] = await db.select().from(schema.incomeCategories).where(eq(schema.incomeCategories.householdId, householdId));
      incomeCatId = incCat!.id;

      const [expCat] = await db.select().from(schema.expenseCategories).where(eq(schema.expenseCategories.householdId, householdId));
      expenseCatId = expCat!.id;

      const [src] = await db.select().from(schema.incomeSources).where(eq(schema.incomeSources.householdId, householdId));
      sourceId = src!.id;

      // Seed 2 incomes and 2 expenses with distinct dates
      await db.insert(schema.incomes).values([
        {
          householdId,
          sourceId,
          categoryId: incomeCatId,
          date: '2026-10-25',
          nominal: '5000000',
          notes: 'Income Test 1',
          createdBy: userId,
        },
        {
          householdId,
          sourceId,
          categoryId: incomeCatId,
          date: '2026-10-27',
          nominal: '3000000',
          notes: 'Income Test 2',
          createdBy: userId,
        },
      ]);

      await db.insert(schema.expenses).values([
        {
          householdId,
          categoryId: expenseCatId,
          date: '2026-10-26',
          nominal: '150000',
          paymentMethod: 'cash',
          notes: 'Expense Test 1',
          createdBy: userId,
        },
        {
          householdId,
          categoryId: expenseCatId,
          date: '2026-10-28',
          nominal: '250000',
          paymentMethod: 'transfer',
          notes: 'Expense Test 2',
          createdBy: userId,
        },
      ]);
    });

    after(async () => {
      // Clean up test transactions
      await db.delete(schema.incomes).where(eq(schema.incomes.householdId, householdId));
      await db.delete(schema.expenses).where(eq(schema.expenses.householdId, householdId));
    });

    it('queries only incomes when type is "income"', async () => {
      const query = transactionQuerySchema.parse({ type: 'income', page: 1, limit: 10 });
      const res = await financeService.listTransactions(householdId, query);
      assert.equal(res.meta.total, 2);
      assert.equal(res.data.length, 2);
      for (const item of res.data) {
        assert.equal(item.type, 'income');
        assert.ok(item.sourceName);
      }
    });

    it('queries only expenses when type is "expense"', async () => {
      const query = transactionQuerySchema.parse({ type: 'expense', page: 1, limit: 10 });
      const res = await financeService.listTransactions(householdId, query);
      assert.equal(res.meta.total, 2);
      assert.equal(res.data.length, 2);
      for (const item of res.data) {
        assert.equal(item.type, 'expense');
        assert.ok(item.paymentMethod);
      }
    });

    it('merges incomes and expenses in type "all" ordered by date DESC', async () => {
      const query = transactionQuerySchema.parse({ type: 'all', page: 1, limit: 10 });
      const res = await financeService.listTransactions(householdId, query);
      assert.equal(res.meta.total, 4);
      assert.equal(res.data.length, 4);

      // Verify date descending order: 2026-10-28, 2026-10-27, 2026-10-26, 2026-10-25
      assert.equal(res.data[0]!.date, '2026-10-28');
      assert.equal(res.data[0]!.type, 'expense');
      assert.equal(res.data[1]!.date, '2026-10-27');
      assert.equal(res.data[1]!.type, 'income');
      assert.equal(res.data[2]!.date, '2026-10-26');
      assert.equal(res.data[2]!.type, 'expense');
      assert.equal(res.data[3]!.date, '2026-10-25');
      assert.equal(res.data[3]!.type, 'income');
    });

    it('paginates correctly with limit and offset', async () => {
      const query1 = transactionQuerySchema.parse({ type: 'all', page: 1, limit: 2 });
      const page1 = await financeService.listTransactions(householdId, query1);
      assert.equal(page1.data.length, 2);
      assert.equal(page1.meta.page, 1);
      assert.equal(page1.meta.limit, 2);
      assert.equal(page1.meta.total, 4);
      assert.equal(page1.meta.totalPages, 2);
      assert.equal(page1.data[0]!.date, '2026-10-28');

      const query2 = transactionQuerySchema.parse({ type: 'all', page: 2, limit: 2 });
      const page2 = await financeService.listTransactions(householdId, query2);
      assert.equal(page2.data.length, 2);
      assert.equal(page2.meta.page, 2);
      assert.equal(page2.data[0]!.date, '2026-10-26');
    });

    it('filters transactions by search query', async () => {
      const query = transactionQuerySchema.parse({ type: 'all', search: 'Expense Test 1' });
      const res = await financeService.listTransactions(householdId, query);
      assert.equal(res.meta.total, 1);
      assert.equal(res.data[0]!.notes, 'Expense Test 1');
    });

    it('filters transactions by date range', async () => {
      const query = transactionQuerySchema.parse({
        type: 'all',
        startDate: '2026-10-27',
        endDate: '2026-10-28',
      });
      const res = await financeService.listTransactions(householdId, query);
      assert.equal(res.meta.total, 2);
    });
  });
});
