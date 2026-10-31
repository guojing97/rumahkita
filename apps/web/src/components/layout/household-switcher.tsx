'use client';

import React from 'react';
import { useHousehold } from '@/contexts/household-context';
import { Home, ChevronDown } from 'lucide-react';
import { Badge } from '@rumahkita/ui';

export function HouseholdSwitcher() {
  const { activeHousehold, households, switchHousehold } = useHousehold();

  if (!activeHousehold) {
    return (
      <div className="p-3 bg-bg border-neo border-ink rounded-card animate-pulse">
        <div className="h-4 bg-ink/10 rounded w-2/3 mb-1" />
        <div className="h-3 bg-ink/10 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className="p-3 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted font-heading">
          Rumah Tangga
        </span>
        <Badge variant={activeHousehold.role === 'owner' ? 'primary' : 'secondary'} className="text-[10px] px-2 py-0">
          {activeHousehold.role === 'owner' ? 'Pemilik' : 'Anggota'}
        </Badge>
      </div>

      {households.length > 1 ? (
        <div className="relative">
          <select
            value={activeHousehold.id}
            onChange={(e) => switchHousehold(e.target.value)}
            className="w-full bg-bg text-ink font-heading font-bold text-sm border border-ink/30 rounded-btn py-1.5 pl-2.5 pr-7 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-ink absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-ink shrink-0" />
          <span className="font-heading font-bold text-sm text-ink truncate">
            {activeHousehold.name}
          </span>
        </div>
      )}
    </div>
  );
}
