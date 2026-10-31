'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@rumahkita/contracts';
import { useAuth } from '@/contexts/auth-context';
import { Button, Input } from '@rumahkita/ui';
import { LogIn, AlertCircle } from 'lucide-react';

function formatLockoutCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 detik';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0 && seconds > 0) {
    return `${minutes} menit ${seconds} detik`;
  }
  if (minutes > 0) {
    return `${minutes} menit (${totalSeconds} detik)`;
  }
  return `${seconds} detik`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const isSafeRedirect =
    rawRedirect &&
    rawRedirect.startsWith('/') &&
    !rawRedirect.startsWith('//') &&
    !rawRedirect.startsWith('/\\') &&
    !rawRedirect.startsWith('/login') &&
    rawRedirect !== '/';

  const redirectPath = isSafeRedirect ? rawRedirect : '/dashboard';
  const { login, isAuthenticated, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [unlockTimestamp, setUnlockTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectPath);
    }
  }, [isAuthenticated, isLoading, redirectPath, router]);

  // Interval timer for 429 lockout countdown with absolute timestamp sync
  useEffect(() => {
    if (!unlockTimestamp) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remainingMs = unlockTimestamp - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      if (remainingSec <= 0) {
        setCountdown(0);
        setUnlockTimestamp(null);
      } else {
        setCountdown(remainingSec);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [unlockTimestamp]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginInput) => {
    if (countdown > 0) return;
    setErrorMessage(null);
    try {
      await login(data);
      router.push(redirectPath);
    } catch (err: any) {
      if (err?.status === 429 || typeof err?.retryAfter === 'number') {
        const retrySec = Number(err?.retryAfter);
        const seconds = !Number.isNaN(retrySec) && retrySec > 0 ? Math.ceil(retrySec) : 180;
        setUnlockTimestamp(Date.now() + seconds * 1000);
        setCountdown(seconds);
        setErrorMessage(null);
      } else {
        setErrorMessage(err.message || 'Email atau kata sandi tidak sesuai. Silakan coba lagi.');
      }
    }
  };

  const isLockedOut = countdown > 0;
  const activeAlertMessage = isLockedOut
    ? `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${formatLockoutCountdown(countdown)}.`
    : errorMessage;

  return (
    <div className="w-full max-w-md bg-surface border-neo-thick border-ink rounded-modal shadow-neo-lg p-6 sm:p-8">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <span className="font-heading font-bold text-3xl text-ink tracking-tight">
            RumahKita
          </span>
          <span className="px-2 py-0.5 bg-primary text-ink border border-ink font-heading font-bold text-xs rounded-badge shadow-neo-sm">
            MVP
          </span>
        </div>
        <p className="font-heading font-bold text-lg text-ink">Urus rumah bareng-bareng.</p>
        <p className="text-xs text-muted font-body mt-1">
          Masuk untuk mencatat keuangan dan mengelola inventori rumah tangga.
        </p>
      </div>

      {/* Global Error Banner */}
      {activeAlertMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-5 p-3.5 bg-[#FEE2E2] border-2 border-danger rounded-btn flex items-start gap-2.5 text-danger font-body text-xs font-semibold"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{activeAlertMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="email"
          label="Alamat Email"
          type="email"
          placeholder="nama@email.com"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          id="password"
          label="Kata Sandi"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={countdown > 0 || isSubmitting}
            className="w-full"
            leftIcon={<LogIn className="w-4 h-4" />}
          >
            Masuk ke RumahKita
          </Button>
        </div>
      </form>

      {/* Seed Info / Demo Hint */}
      <div className="mt-6 pt-4 border-t border-ink/15 text-center">
        <p className="text-[11px] text-muted font-body">
          Akun bawaan sistem: <code className="font-bold text-ink">hendrawankevin97@gmail.com</code> /{' '}
          <code className="font-bold text-ink">e5f6g7h8</code>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-surface border-neo-thick border-ink rounded-modal shadow-neo-lg p-8 text-center">
            <p className="font-heading font-bold text-sm text-ink">Memuat formulir masuk...</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
