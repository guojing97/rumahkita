'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Package,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@rumahkita/ui';
import { MoreMenuDrawer } from './more-menu-drawer';
import { Ripple } from '@/components/ui/ripple';

export function MobileBottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transaksi', label: 'Transaksi', icon: Receipt },
    { href: '/inventori', label: 'Inventori', icon: Package },
    { href: '/laporan', label: 'Laporan', icon: BarChart3 },
  ];

  const isMoreActive =
    pathname?.startsWith('/hutang') ||
    pathname?.startsWith('/pengaturan');

  return (
    <>
      <nav className="h-16 fixed bottom-0 left-0 right-0 bg-surface border-t-neo border-ink z-40 flex items-center justify-around px-1 lg:hidden select-none">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] px-1 transition-colors overflow-hidden',
                isActive ? 'text-ink font-bold' : 'text-muted hover:text-ink'
              )}
            >
              <div
                className={cn(
                  'p-1 rounded-btn transition-transform',
                  isActive && 'bg-primary border border-ink shadow-neo-sm -translate-y-0.5'
                )}
              >
                <Icon className="w-5 h-5 text-ink" />
              </div>
              <span className="text-[10px] font-heading mt-0.5 tracking-tight">{item.label}</span>
              <Ripple color={isActive ? 'primary' : 'neutral'} />
            </Link>
          );
        })}

        {/* 5th Item: Lainnya Drawer Trigger */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] min-w-[44px] px-1 transition-colors cursor-pointer overflow-hidden',
            isMoreActive ? 'text-ink font-bold' : 'text-muted hover:text-ink'
          )}
        >
          <div
            className={cn(
              'p-1 rounded-btn transition-transform',
              isMoreActive && 'bg-primary border border-ink shadow-neo-sm -translate-y-0.5'
            )}
          >
            <MoreHorizontal className="w-5 h-5 text-ink" />
          </div>
          <span className="text-[10px] font-heading mt-0.5 tracking-tight">Lainnya</span>
          <Ripple color={isMoreActive ? 'primary' : 'neutral'} />
        </button>
      </nav>

      <MoreMenuDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
