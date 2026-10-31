'use client';

import React from 'react';
import Link from 'next/link';
import { useHousehold } from '@/contexts/household-context';
import { Home } from 'lucide-react';
import { Badge } from '@rumahkita/ui';
import { Ripple } from '@/components/ui/ripple';

export function MobileTopBar() {
  const { activeHousehold } = useHousehold();

  return (
    <header className="h-14 sticky top-0 bg-surface border-b-neo border-ink z-30 flex items-center justify-between px-4 lg:hidden select-none">
      <Link
        href="/dashboard"
        className="relative flex items-center gap-2 p-1.5 -ml-1.5 rounded-btn overflow-hidden transition-colors hover:bg-bg/60"
      >
        <div className="w-8 h-8 rounded-btn bg-primary border-neo border-ink flex items-center justify-center font-heading font-bold text-xs text-ink shadow-neo-sm shrink-0">
          RK
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-heading font-bold text-sm text-ink truncate max-w-[150px]">
              {activeHousehold?.name || 'RumahKita'}
            </span>
            {activeHousehold && (
              <Badge
                variant={activeHousehold.role === 'owner' ? 'primary' : 'secondary'}
                className="text-[9px] px-1.5 py-0"
              >
                {activeHousehold.role === 'owner' ? 'Pemilik' : 'Anggota'}
              </Badge>
            )}
          </div>
        </div>
        <Ripple color="neutral" />
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="relative p-2 rounded-btn bg-bg border border-ink/30 text-ink hover:bg-surface min-h-[44px] min-w-[44px] flex items-center justify-center overflow-hidden transition-colors"
          aria-label="Beranda"
        >
          <Home className="w-5 h-5" />
          <Ripple color="neutral" />
        </Link>
      </div>
    </header>
  );
}
