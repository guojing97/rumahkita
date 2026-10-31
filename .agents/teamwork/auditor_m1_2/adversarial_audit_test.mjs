import assert from 'node:assert/strict';
import {
  idrAmountSchema,
  optionalIdrAmountSchema,
  formatIDR,
  parseIDR,
  calculateStockStatus,
  evaluateStockThresholdTransition,
  loginSchema,
  registerSchema,
  inviteMemberSchema,
  forgotPasswordSchema,
  createIncomeSchema,
  createExpenseSchema,
  stockAdjustmentSchema,
  createDebtReceivableSchema,
  recordPaymentSchema,
  createPurchaseSchema,
} from '../../../packages/contracts/dist/index.js';

console.log('--- Starting Independent Forensic Auditor Adversarial Test Suite ---');
let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// 1. IDR Amount Validation Stress Test
runTest('idrAmountSchema rejects zero, negative, floats, booleans, and non-numbers', () => {
  assert.equal(idrAmountSchema.safeParse(0).success, false);
  assert.equal(idrAmountSchema.safeParse(-1).success, false);
  assert.equal(idrAmountSchema.safeParse(10.5).success, false);
  assert.equal(idrAmountSchema.safeParse(true).success, false);
  assert.equal(idrAmountSchema.safeParse(false).success, false);
  assert.equal(idrAmountSchema.safeParse('not-a-number').success, false);
  assert.equal(idrAmountSchema.safeParse({}).success, false);
  assert.equal(idrAmountSchema.safeParse([]).success, false);
  assert.equal(idrAmountSchema.safeParse(1_000_000_000_000).success, false); // exceeds max
});

runTest('idrAmountSchema accepts positive integers and coerces valid numeric strings', () => {
  const p1 = idrAmountSchema.safeParse(1);
  assert.equal(p1.success, true);
  assert.equal(p1.data, 1);

  const p2 = idrAmountSchema.safeParse('500000');
  assert.equal(p2.success, true);
  assert.equal(p2.data, 500000);

  const p3 = idrAmountSchema.safeParse(999_999_999_999);
  assert.equal(p3.success, true);
  assert.equal(p3.data, 999_999_999_999);
});

// 2. Optional IDR Amount Validation
runTest('optionalIdrAmountSchema preserves null/empty/undefined as undefined without turning to 0', () => {
  const nullCheck = optionalIdrAmountSchema.safeParse(null);
  assert.equal(nullCheck.success, true);
  assert.equal(nullCheck.data, undefined);

  const emptyCheck = optionalIdrAmountSchema.safeParse('');
  assert.equal(emptyCheck.success, true);
  assert.equal(emptyCheck.data, undefined);

  const undefCheck = optionalIdrAmountSchema.safeParse(undefined);
  assert.equal(undefCheck.success, true);
  assert.equal(undefCheck.data, undefined);

  const zeroCheck = optionalIdrAmountSchema.safeParse(0);
  assert.equal(zeroCheck.success, true);
  assert.equal(zeroCheck.data, 0);

  assert.equal(optionalIdrAmountSchema.safeParse(true).success, false);
  assert.equal(optionalIdrAmountSchema.safeParse(false).success, false);
  assert.equal(optionalIdrAmountSchema.safeParse(-10).success, false);
});

// 3. IDR Parsing and Formatting
runTest('parseIDR handles Indonesian formatted currency and edge cases', () => {
  assert.equal(parseIDR('Rp 1.500.000,00'), 1500000);
  assert.equal(parseIDR('Rp 150.000,00'), 150000);
  assert.equal(parseIDR('Rp 150.000,99'), 150000);
  assert.equal(parseIDR('150000'), 150000);
  assert.equal(parseIDR('   Rp 2.500.000   '), 2500000);
  assert.equal(parseIDR('invalid'), 0);
  assert.equal(parseIDR(''), 0);
});

runTest('formatIDR formats currency correctly in id-ID locale', () => {
  const str = formatIDR(2500000);
  assert.ok(str.includes('2.500.000'));
});

// 4. Auth Email Preprocessing and Normalization
runTest('Auth schemas normalize emails with trim and lowercase, rejecting empty/invalid', () => {
  const dirtyEmail = '  Budi.Santoso+Tag@RUMAHKITA.local  ';
  const loginRes = loginSchema.safeParse({ email: dirtyEmail, password: 'Password123!' });
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.data.email, 'budi.santoso+tag@rumahkita.local');

  const regRes = registerSchema.safeParse({
    email: '  User@Domain.Com ',
    password: 'Password123!',
    fullName: 'Test User',
  });
  assert.equal(regRes.success, true);
  assert.equal(regRes.data.email, 'user@domain.com');

  assert.equal(loginSchema.safeParse({ email: '   ', password: 'Password123!' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'not-an-email', password: 'Password123!' }).success, false);
  assert.equal(loginSchema.safeParse({ email: 'user@domain.com', password: 'short' }).success, false);
});

// 5. Stock Status and Transitions
runTest('calculateStockStatus and evaluateStockThresholdTransition maintain correct invariants', () => {
  assert.equal(calculateStockStatus(0, 5), 'OUT');
  assert.equal(calculateStockStatus(-2, 5), 'OUT');
  assert.equal(calculateStockStatus(5, 5), 'LOW');
  assert.equal(calculateStockStatus(3, 5), 'LOW');
  assert.equal(calculateStockStatus(6, 5), 'SAFE');

  // Safe -> Low
  const t1 = evaluateStockThresholdTransition(10, 4, 5);
  assert.equal(t1.shouldNotify, true);
  assert.equal(t1.eventType, 'STOCK_LOW');

  // Safe -> Out
  const t2 = evaluateStockThresholdTransition(10, 0, 5);
  assert.equal(t2.shouldNotify, true);
  assert.equal(t2.eventType, 'STOCK_OUT');

  // Already Low -> Further Low (no duplicate spam)
  const t3 = evaluateStockThresholdTransition(4, 2, 5);
  assert.equal(t3.shouldNotify, false);
  assert.equal(t3.eventType, null);

  // Replenished
  const t4 = evaluateStockThresholdTransition(1, 10, 5);
  assert.equal(t4.shouldNotify, false);
  assert.equal(t4.eventType, null);
});

// 6. Stock Adjustment Validation
runTest('stockAdjustmentSchema requires non-zero delta and non-whitespace reason >= 3 chars', () => {
  assert.equal(stockAdjustmentSchema.safeParse({ delta: 0, reason: 'Alasan valid' }).success, false);
  assert.equal(stockAdjustmentSchema.safeParse({ delta: 5, reason: '' }).success, false);
  assert.equal(stockAdjustmentSchema.safeParse({ delta: 5, reason: '   ' }).success, false);
  assert.equal(stockAdjustmentSchema.safeParse({ delta: 5, reason: ' \t \n ' }).success, false);
  assert.equal(stockAdjustmentSchema.safeParse({ delta: 5, reason: 'ab' }).success, false);

  const validAdj = stockAdjustmentSchema.safeParse({ delta: -2, reason: 'Barang rusak / pecah' });
  assert.equal(validAdj.success, true);
  assert.equal(validAdj.data.delta, -2);
  assert.equal(validAdj.data.reason, 'Barang rusak / pecah');

  // Trimming test
  const trimmedAdj = stockAdjustmentSchema.safeParse({ delta: 3, reason: '  Restock mingguan  ' });
  assert.equal(trimmedAdj.success, true);
  assert.equal(trimmedAdj.data.reason, 'Restock mingguan');
});

// 7. Finance Transactions (Income & Expense)
const testUuid = '0192e20b-0000-7000-8000-000000000001';
runTest('createIncomeSchema enforces nominal > 0, UUID sourceId, and YYYY-MM-DD date', () => {
  assert.equal(createIncomeSchema.safeParse({ date: '2026-10-27', nominal: 0, sourceId: testUuid }).success, false);
  assert.equal(createIncomeSchema.safeParse({ date: '2026-10-27', nominal: -100, sourceId: testUuid }).success, false);
  assert.equal(createIncomeSchema.safeParse({ date: '2026-10-27', nominal: 100000, sourceId: 'not-a-uuid' }).success, false);
  assert.equal(createIncomeSchema.safeParse({ date: '27/10/2026', nominal: 100000, sourceId: testUuid }).success, false);

  const validInc = createIncomeSchema.safeParse({ date: '2026-10-27', nominal: 1500000, sourceId: testUuid });
  assert.equal(validInc.success, true);
});

runTest('createExpenseSchema enforces categoryId UUID, nominal > 0, and YYYY-MM-DD date', () => {
  assert.equal(createExpenseSchema.safeParse({ date: '2026-10-27', nominal: 50000 }).success, false); // missing categoryId
  assert.equal(createExpenseSchema.safeParse({ date: '2026-10-27', nominal: 50000, categoryId: 'not-a-uuid' }).success, false);
  assert.equal(createExpenseSchema.safeParse({ date: '2026-10-27', nominal: 0, categoryId: testUuid }).success, false);

  const validExp = createExpenseSchema.safeParse({ date: '2026-10-27', nominal: 75000, categoryId: testUuid });
  assert.equal(validExp.success, true);
});

// 8. Purchases Validation
runTest('createPurchaseSchema enforces at least 1 item and validates item structures', () => {
  assert.equal(createPurchaseSchema.safeParse({
    date: '2026-10-27',
    expenseCategoryId: testUuid,
    items: [],
  }).success, false);

  assert.equal(createPurchaseSchema.safeParse({
    date: '2026-10-27',
    expenseCategoryId: testUuid,
    items: [{ itemName: 'Beras', quantity: 0, unitPrice: 50000 }],
  }).success, false); // quantity must be positive

  assert.equal(createPurchaseSchema.safeParse({
    date: '2026-10-27',
    expenseCategoryId: testUuid,
    items: [{ itemName: 'Beras', quantity: 1, unitPrice: 0 }],
  }).success, false); // unitPrice must be positive IDR

  const validPurchase = createPurchaseSchema.safeParse({
    date: '2026-10-27',
    expenseCategoryId: testUuid,
    items: [{ itemName: 'Beras', quantity: 2, unitPrice: 75000 }],
  });
  assert.equal(validPurchase.success, true);
});

// 9. Debts & Receivables Validation
runTest('createDebtReceivableSchema and recordPaymentSchema enforce positive amounts and valid types', () => {
  assert.equal(createDebtReceivableSchema.safeParse({
    type: 'invalid-type',
    partyName: 'Pak Budi',
    principalAmount: 100000,
  }).success, false);

  assert.equal(createDebtReceivableSchema.safeParse({
    type: 'payable',
    partyName: 'A', // too short (< 2)
    principalAmount: 100000,
  }).success, false);

  assert.equal(createDebtReceivableSchema.safeParse({
    type: 'payable',
    partyName: 'Pak Budi',
    principalAmount: 0,
  }).success, false);

  const validDebt = createDebtReceivableSchema.safeParse({
    type: 'payable',
    partyName: 'Pak Budi',
    principalAmount: 1000000,
  });
  assert.equal(validDebt.success, true);

  assert.equal(recordPaymentSchema.safeParse({
    paymentDate: '2026-10-27',
    amount: 0,
  }).success, false);

  const validPayment = recordPaymentSchema.safeParse({
    paymentDate: '2026-10-27',
    amount: 300000,
  });
  assert.equal(validPayment.success, true);
});

console.log(`\nAll ${passed}/${total} independent adversarial test assertions passed cleanly!`);
