'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile, HouseholdSummary } from '@/types/auth';
import { setApiAuthToken, apiFetch } from '@/lib/api-fetcher';
import { LoginInput } from '@rumahkita/contracts';

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setApiAuthToken(token);
  }, []);

  // 1. Silent token refresh on initial boot
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (!res.ok) {
        applyAccessToken(null);
        setUser(null);
        return false;
      }

      const envelope = await res.json().catch(() => null);
      const newToken = envelope?.data?.accessToken;
      if (!newToken) {
        applyAccessToken(null);
        setUser(null);
        return false;
      }

      applyAccessToken(newToken);

      // Fetch user profile and household list
      const meData = await apiFetch<{ user: UserProfile; households: HouseholdSummary[] }>('/auth/me');
      setUser(meData.user);
      return true;
    } catch {
      applyAccessToken(null);
      setUser(null);
      return false;
    }
  }, [applyAccessToken]);

  useEffect(() => {
    refreshSession().catch(() => false).finally(() => setIsLoading(false));
  }, [refreshSession]);

  // 2. Login action with defensive network error handling
  const login = async (credentials: LoginInput) => {
    let res: Response;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'same-origin',
      });
    } catch {
      throw new Error(
        'Tidak dapat terhubung ke server RumahKita. Pastikan koneksi dan layanan server aktif.'
      );
    }

    const envelope = await res.json().catch(() => null);
    if (!res.ok || !envelope?.success) {
      const retryAfterHeader = res.headers.get('retry-after');
      let retryAfter: number | undefined;
      if (typeof envelope?.retryAfter === 'number') {
        retryAfter = envelope.retryAfter;
      } else if (retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))) {
        retryAfter = Number(retryAfterHeader);
      }

      const defaultMsg =
        res.status === 429
          ? 'Terlalu banyak percobaan login gagal. Akun sementara dikunci demi keamanan.'
          : res.status === 502
            ? 'Tidak dapat terhubung ke server RumahKita. Pastikan koneksi dan layanan server aktif.'
            : 'Login gagal. Periksa kembali email dan kata sandi Anda.';

      const errorMessage = envelope?.message || defaultMsg;
      const err = new Error(errorMessage);
      (err as any).status = res.status;
      if (res.status === 429 || retryAfter !== undefined) {
        (err as any).retryAfter =
          retryAfter !== undefined && !Number.isNaN(retryAfter)
            ? retryAfter
            : 180;
      }
      throw err;
    }

    const { accessToken: token, user: userData } = envelope.data;
    applyAccessToken(token);
    setUser(userData);
  };

  // 3. Logout action
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      applyAccessToken(null);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
