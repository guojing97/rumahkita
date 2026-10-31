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
  createIncomeSchema,
  createExpenseSchema,
  stockAdjustmentSchema,
  createPurchaseSchema,
  createDebtReceivableSchema,
  recordPaymentSchema,
} from '../../../packages/contracts/dist/index.js';
import { neoBrutalismPreset } from '../../../packages/ui/dist/preset.js';

console.log('--- STARTING ADVERSARIAL INTEGRITY VERIFICATION ---');

// 1. IDR Amount Validation & Formatting
console.log('Testing IDR Amount...');
assert.equal(idrAmountSchema.safeParse(0).success, false, '0 must be rejected');
assert.equal(idrAmountSchema.safeParse(-100).success, false, 'Negative must be rejected');
assert.equal(idrAmountSchema.safeParse(99.99).success, false, 'Decimals must be rejected');
assert.equal(idrAmountSchema.safeParse(1_000_000_000_000).success, false, 'Exceeding max must be rejected');
assert.equal(idrAmountSchema.safeParse('not-a-number').success, false, 'NaN string rejected');
assert.equal(idrAmountSchema.safeParse(50000).success, true, 'Valid positive int accepted');
assert.equal(idrAmountSchema.safeParse('50000').success, true, 'Coerced valid positive int accepted');

assert.equal(optionalIdrAmountSchema.safeParse(0).success, true, 'Optional IDR allows 0');
assert.equal(optionalIdrAmountSchema.safeParse(undefined).success, true, 'Optional IDR allows undefined');
assert.equal(optionalIdrAmountSchema.safeParse(-1).success, false, 'Optional IDR rejects negative');

const formatted = formatIDR(2500000);
assert.match(formatted, /Rp\s?2\.500\.000/, 'formatIDR produces correct Indonesian Rupiah format');
assert.equal(parseIDR('Rp 2.500.000'), 2500000, 'parseIDR correctly recovers integer');

// 2. Stock Status and Transition Logic
console.log('Testing Stock Status and Transition Deduplication...');
assert.equal(calculateStockStatus(10, 5), 'SAFE');
assert.equal(calculateStockStatus(5, 5), 'LOW');
assert.equal(calculateStockStatus(1, 5), 'LOW');
assert.equal(calculateStockStatus(0, 5), 'OUT');
assert.equal(calculateStockStatus(-3, 5), 'OUT');

// Safe -> Low
const t1 = evaluateStockThresholdTransition(10, 5, 5);
assert.equal(t1.shouldNotify, true, '10 -> 5 (threshold 5) should notify');
assert.equal(t1.eventType, 'STOCK_LOW');

// Low -> Lower (already low)
const t2 = evaluateStockThresholdTransition(5, 4, 5);
assert.equal(t2.shouldNotify, false, '5 -> 4 (threshold 5) must NOT notify (suppress duplicate)');

// Low -> Out
const t3 = evaluateStockThresholdTransition(4, 0, 5);
assert.equal(t3.shouldNotify, true, '4 -> 0 should notify STOCK_OUT');
assert.equal(t3.eventType, 'STOCK_OUT');

// Out -> Out (further negative)
const t4 = evaluateStockThresholdTransition(0, -2, 5);
assert.equal(t4.shouldNotify, false, '0 -> -2 must NOT notify (already out)');

// Replenished: Low -> Safe
const t5 = evaluateStockThresholdTransition(2, 10, 5);
assert.equal(t5.shouldNotify, false, 'Replenishment must not notify');

// 3. Domain Schemas Validation
console.log('Testing Domain Schemas...');
// Income requires sourceId
const inc1 = createIncomeSchema.safeParse({
  date: '2026-10-27',
  nominal: 100000,
});
assert.equal(inc1.success, false, 'Income without sourceId rejected');

// Expense requires categoryId
const exp1 = createExpenseSchema.safeParse({
  date: '2026-10-27',
  nominal: 50000,
});
assert.equal(exp1.success, false, 'Expense without categoryId rejected');

// Invalid UUIDs
const expInvalidUuid = createExpenseSchema.safeParse({
  date: '2026-10-27',
  nominal: 50000,
  categoryId: 'not-a-uuid',
});
assert.equal(expInvalidUuid.success, false, 'Expense with invalid UUID categoryId rejected');

// Stock adjustment rejects delta = 0 and short reason
assert.equal(
  stockAdjustmentSchema.safeParse({ delta: 0, reason: 'Valid reason' }).success,
  false,
  'Delta 0 rejected'
);
assert.equal(
  stockAdjustmentSchema.safeParse({ delta: 5, reason: 'ab' }).success,
  false,
  'Reason < 3 chars rejected'
);
assert.equal(
  stockAdjustmentSchema.safeParse({ delta: 5, reason: 'Restok supplier' }).success,
  true,
  'Valid stock adjustment accepted'
);

// Purchase requires items >= 1
assert.equal(
  createPurchaseSchema.safeParse({
    date: '2026-10-27',
    expenseCategoryId: '0192e20b-0000-7000-8000-000000000001',
    items: [],
  }).success,
  false,
  'Purchase with empty items array rejected'
);

assert.equal(
  createPurchaseSchema.safeParse({
    date: '2026-10-27',
    expenseCategoryId: '0192e20b-0000-7000-8000-000000000001',
    items: [
      {
        itemName: 'Beras Rojolele 5kg',
        quantity: 2,
        unitPrice: 75000,
      },
    ],
  }).success,
  true,
  'Valid purchase accepted'
);

// Payment recording rejects nominal <= 0
assert.equal(
  recordPaymentSchema.safeParse({
    paymentDate: '2026-10-27',
    amount: -100,
  }).success,
  false,
  'Negative payment amount rejected'
);

// 4. UI Design Tokens verification
console.log('Testing UI Design Tokens preset...');
const colors = neoBrutalismPreset.theme.extend.colors;
assert.equal(colors.bg, 'var(--bg)');
assert.equal(colors.ink, 'var(--ink)');
assert.equal(colors.primary.DEFAULT, 'var(--primary)');
assert.equal(colors.primary.hover, '#B5DF53');
assert.equal(neoBrutalismPreset.theme.extend.boxShadow.neo, '4px 4px 0 var(--ink)');
assert.equal(neoBrutalismPreset.theme.extend.borderWidth.neo, '2px');

console.log('--- ALL ADVERSARIAL INTEGRITY VERIFICATIONS PASSED ---');
