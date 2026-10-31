'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Package,
  HandCoins,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@rumahkita/ui';
import { HouseholdSwitcher } from './household-switcher';
import { UserBadge } from './user-badge';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transaksi', label: 'Transaksi', icon: Receipt },
  { href: '/inventori', label: 'Inventori', icon: Package },
  { href: '/hutang', label: 'Hutang & Piutang', icon: HandCoins },
  { href: '/laporan', label: 'Laporan', icon: BarChart3 },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings },
];

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 bg-surface border-r-neo border-ink flex-col p-4 z-40 hidden lg:flex select-none">
      {/* Brand Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-xl text-ink tracking-tight">
            RumahKita
          </span>
          <span className="px-1.5 py-0.2 bg-primary text-ink border border-ink font-heading font-bold text-[10px] rounded-badge">
            MVP
          </span>
        </div>
        <p className="text-xs text-muted font-body mt-0.5">Urus rumah bareng-bareng.</p>
      </div>

      {/* Household Switcher */}
      <div className="mb-4">
        <HouseholdSwitcher />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150',
                isActive
                  ? 'bg-primary text-ink border-2 border-ink shadow-[4px_4px_0_#171717] font-bold rounded-btn'
                  : 'text-ink/80 hover:text-ink hover:bg-ink/5 border-2 border-transparent hover:border-ink/20 font-medium rounded-btn'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Badge */}
      <div className="mt-auto pt-3 border-t border-ink/15">
        <UserBadge />
      </div>
    </aside>
  );
}
