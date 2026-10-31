import { Injectable, OnModuleDestroy } from '@nestjs/common';

export interface ThrottleEntry {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

export interface ThrottleStatus {
  isLocked: boolean;
  remainingSeconds: number;
}

export interface ThrottleFailureResult {
  attempts: number;
  isLocked: boolean;
  remainingSeconds: number;
}

@Injectable()
export class LoginThrottleService implements OnModuleDestroy {
  public static readonly MAX_ATTEMPTS = 3;
  public static readonly LOCKOUT_DURATION_MS = 3 * 60 * 1000; // 180,000 ms (3 menit)
  public static readonly CLEANUP_TTL_MS = 5 * 60 * 1000; // 5 menit
  public static readonly MAX_TRACKED_IDENTIFIERS = 10_000;

  private readonly attempts = new Map<string, ThrottleEntry>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldEntries();
    }, 60 * 1000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  private normalizeIdentifier(identifier: string): string {
    return typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  }

  /**
   * Memeriksa status throttle untuk identifier (email).
   */
  checkThrottle(identifier: string): ThrottleStatus {
    const key = this.normalizeIdentifier(identifier);
    const entry = this.attempts.get(key);
    if (!entry) {
      return { isLocked: false, remainingSeconds: 0 };
    }

    const now = Date.now();
    if (entry.lockedUntil !== null) {
      if (entry.lockedUntil > now) {
        const remainingSeconds = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
        return { isLocked: true, remainingSeconds };
      }

      // Masa lockout selesai, reset attempts dan status lock
      entry.attempts = 0;
      entry.lockedUntil = null;
      return { isLocked: false, remainingSeconds: 0 };
    }

    return { isLocked: false, remainingSeconds: 0 };
  }

  /**
   * Mencatat percobaan login yang gagal.
   * Jika kegagalan mencapai batas (MAX_ATTEMPTS), identifier akan dikunci selama LOCKOUT_DURATION_MS.
   */
  recordFailure(identifier: string): ThrottleFailureResult {
    const key = this.normalizeIdentifier(identifier);
    const now = Date.now();
    let entry = this.attempts.get(key);

    if (!entry) {
      if (this.attempts.size >= LoginThrottleService.MAX_TRACKED_IDENTIFIERS) {
        const oldestKey = this.attempts.keys().next().value;
        if (oldestKey) {
          this.attempts.delete(oldestKey);
        }
      }

      entry = {
        attempts: 0,
        lockedUntil: null,
        lastAttemptAt: now,
      };
      this.attempts.set(key, entry);
    } else if (entry.lockedUntil !== null && entry.lockedUntil <= now) {
      // Masa lockout sebelumnya telah berakhir
      entry.attempts = 0;
      entry.lockedUntil = null;
    }

    entry.attempts += 1;
    entry.lastAttemptAt = now;

    // Refresh position to LRU tail on attempt
    this.attempts.delete(key);
    this.attempts.set(key, entry);

    let isLocked = false;
    let remainingSeconds = 0;

    if (entry.attempts >= LoginThrottleService.MAX_ATTEMPTS) {
      entry.lockedUntil = now + LoginThrottleService.LOCKOUT_DURATION_MS;
      isLocked = true;
      remainingSeconds = Math.ceil(LoginThrottleService.LOCKOUT_DURATION_MS / 1000);
    }

    return {
      attempts: entry.attempts,
      isLocked,
      remainingSeconds,
    };
  }

  /**
   * Mereset counter kegagalan setelah login berhasil.
   */
  reset(identifier: string): void {
    const key = this.normalizeIdentifier(identifier);
    this.attempts.delete(key);
  }

  /**
   * Menghapus entri yang sudah tidak aktif (> 5 menit) untuk mencegah kebocoran memori.
   */
  cleanupOldEntries(now: number = Date.now()): void {
    for (const [key, entry] of this.attempts.entries()) {
      const isLockExpiredOrInactive =
        entry.lockedUntil === null || entry.lockedUntil <= now;
      const isExpired = now - entry.lastAttemptAt > LoginThrottleService.CLEANUP_TTL_MS;

      if (isLockExpiredOrInactive && isExpired) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Helper untuk keperluan unit testing / debugging.
   */
  getEntry(identifier: string): ThrottleEntry | undefined {
    return this.attempts.get(this.normalizeIdentifier(identifier));
  }

  /**
   * Helper untuk mereset seluruh cache saat testing.
   */
  clear(): void {
    this.attempts.clear();
  }
}
