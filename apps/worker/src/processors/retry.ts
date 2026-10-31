export interface BackoffResult {
  canRetry: boolean;
  nextRetryAt: Date | null;
  delaySeconds: number;
}

/**
 * Calculates exponential backoff delay based on current attempts.
 *
 * Formula:
 * For attempt k: delay = min(maxDelay, baseSeconds * 2^(k - 1))
 * If attempts >= maxAttempts, returns canRetry: false, nextRetryAt: null.
 *
 * @param attempts Total attempts already made (1-based count)
 * @param maxAttempts Maximum allowed attempts (default 5)
 * @param baseSeconds Base backoff delay in seconds (default 30, from WORKER_BACKOFF_BASE_SEC or 30)
 * @param maxDelaySeconds Maximum delay cap (default 1800 = 30 minutes)
 */
export function calculateExponentialBackoff(
  attempts: number,
  maxAttempts: number = 5,
  baseSeconds: number = 30,
  maxDelaySeconds: number = 1800
): BackoffResult {
  if (attempts >= maxAttempts) {
    return {
      canRetry: false,
      nextRetryAt: null,
      delaySeconds: 0,
    };
  }

  // retryIndex: 0 for 1st failed attempt, 1 for 2nd, etc.
  const retryIndex = Math.max(0, attempts - 1);
  const exponentialMultiplier = Math.pow(2, retryIndex);
  const delaySeconds = Math.min(maxDelaySeconds, exponentialMultiplier * baseSeconds);
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);

  return {
    canRetry: true,
    nextRetryAt,
    delaySeconds,
  };
}
