import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateExponentialBackoff } from '../processors/retry';

describe('calculateExponentialBackoff', () => {
  it('calculates initial retry delay for attempt 1 (base 30s)', () => {
    const result = calculateExponentialBackoff(1, 5, 30);
    assert.equal(result.canRetry, true);
    assert.equal(result.delaySeconds, 30); // 30 * 2^0
    assert.ok(result.nextRetryAt instanceof Date);
    const diffMs = result.nextRetryAt.getTime() - Date.now();
    assert.ok(diffMs >= 29000 && diffMs <= 31000);
  });

  it('calculates exponential doubling for attempts 2, 3, and 4', () => {
    const attempt2 = calculateExponentialBackoff(2, 5, 30);
    assert.equal(attempt2.canRetry, true);
    assert.equal(attempt2.delaySeconds, 60); // 30 * 2^1

    const attempt3 = calculateExponentialBackoff(3, 5, 30);
    assert.equal(attempt3.canRetry, true);
    assert.equal(attempt3.delaySeconds, 120); // 30 * 2^2

    const attempt4 = calculateExponentialBackoff(4, 5, 30);
    assert.equal(attempt4.canRetry, true);
    assert.equal(attempt4.delaySeconds, 240); // 30 * 2^3
  });

  it('marks dead-letter when attempts reach maxAttempts (5)', () => {
    const result = calculateExponentialBackoff(5, 5, 30);
    assert.equal(result.canRetry, false);
    assert.equal(result.nextRetryAt, null);
    assert.equal(result.delaySeconds, 0);
  });

  it('marks dead-letter when attempts exceed maxAttempts', () => {
    const result = calculateExponentialBackoff(8, 5, 30);
    assert.equal(result.canRetry, false);
    assert.equal(result.nextRetryAt, null);
    assert.equal(result.delaySeconds, 0);
  });

  it('caps delay at maxDelaySeconds', () => {
    // With base 300, 300 * 2^3 = 2400 > 1800
    const result = calculateExponentialBackoff(4, 10, 300, 1800);
    assert.equal(result.canRetry, true);
    assert.equal(result.delaySeconds, 1800);
  });

  it('supports custom base delay in seconds', () => {
    const result = calculateExponentialBackoff(2, 5, 60);
    assert.equal(result.canRetry, true);
    assert.equal(result.delaySeconds, 120); // 60 * 2^1
  });
});
