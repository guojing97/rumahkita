'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { HouseholdSummary } from '@/types/auth';
import { useAuth } from './auth-context';
import { apiFetch, setApiHouseholdId } from '@/lib/api-fetcher';

const STORAGE_KEY = 'rumahkita_active_household_id';

interface HouseholdContextType {
  activeHousehold: HouseholdSummary | null;
  households: HouseholdSummary[];
  isOwner: boolean;
  isLoading: boolean;
  switchHousehold: (householdId: string) => void;
  refreshHouseholds: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [activeHousehold, setActiveHousehold] = useState<HouseholdSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const switchHousehold = useCallback(
    (householdId: string) => {
      const target = households.find((h) => h.id === householdId);
      if (target) {
        setActiveHousehold(target);
        setApiHouseholdId(target.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, target.id);
        }
      }
    },
    [households]
  );

  const refreshHouseholds = useCallback(async () => {
    if (!isAuthenticated) {
      setHouseholds([]);
      setActiveHousehold(null);
      setApiHouseholdId(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await apiFetch<{ households: HouseholdSummary[] }>('/auth/me');
      const list = data.households || [];
      setHouseholds(list);

      // Select active household from localStorage, or owner, or first
      const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const matched = list.find((h) => h.id === storedId);
      const owner = list.find((h) => h.role === 'owner');
      const selected = matched || owner || list[0] || null;

      setActiveHousehold(selected);
      setApiHouseholdId(selected ? selected.id : null);
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshHouseholds();
  }, [refreshHouseholds]);

  return (
    <HouseholdContext.Provider
      value={{
        activeHousehold,
        households,
        isOwner: activeHousehold?.role === 'owner',
        isLoading,
        switchHousehold,
        refreshHouseholds,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
}
