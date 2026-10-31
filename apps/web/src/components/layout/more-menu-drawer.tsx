'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { HandCoins, BarChart3, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@rumahkita/ui';
import { Ripple } from '@/components/ui/ripple';

interface MoreMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreMenuDrawer({ open, onOpenChange }: MoreMenuDrawerProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const menuItems = [
    {
      href: '/hutang',
      label: 'Hutang & Piutang',
      desc: 'Pantau pinjaman, piutang, dan progres pelunasan',
      icon: HandCoins,
    },
    {
      href: '/laporan',
      label: 'Laporan & Ekspor CSV',
      desc: 'Arus kas bulanan, tahunan, dan unduhan transaksi',
      icon: BarChart3,
    },
    {
      href: '/pengaturan',
      label: 'Pengaturan Rumah Tangga',
      desc: 'Kelola anggota, kategori, dan notifikasi stok',
      icon: Settings,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Menu Lainnya">
      <div className="space-y-2 py-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              className={cn(
                'relative flex items-center gap-3.5 p-3 rounded-card border-2 transition-all overflow-hidden',
                isActive
                  ? 'bg-primary text-ink border-ink shadow-neo-sm font-bold'
                  : 'bg-surface hover:bg-bg border-ink text-ink shadow-neo-sm font-medium'
              )}
            >
              <div className="p-2 rounded-btn bg-bg border border-ink/20 shrink-0">
                <Icon className="w-5 h-5 text-ink" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm text-ink leading-tight">{item.label}</p>
                <p className="text-xs text-muted font-body mt-0.5">{item.desc}</p>
              </div>
              <Ripple color={isActive ? 'primary' : 'neutral'} />
            </Link>
          );
        })}

        {/* User Profile & Logout Section */}
        {user && (
          <div className="mt-4 pt-3 border-t border-ink/15 flex items-center justify-between p-3 bg-bg border border-ink/20 rounded-card">
            <div className="min-w-0">
              <p className="font-heading font-bold text-xs text-ink truncate">{user.fullName}</p>
              <p className="font-body text-[11px] text-muted truncate">{user.email}</p>
            </div>
            <button
              onClick={() => {
                onOpenChange(false);
                logout();
              }}
              className="relative inline-flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-danger hover:text-white border border-ink rounded-btn text-xs font-semibold font-body text-danger shadow-neo-sm transition-colors cursor-pointer shrink-0 overflow-hidden"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
              <Ripple color="neutral" />
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
