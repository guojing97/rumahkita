'use client';

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { LogOut, User } from 'lucide-react';

export function UserBadge() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-card bg-bg border-neo border-ink">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-full bg-secondary border border-ink flex items-center justify-center font-heading font-bold text-xs text-ink shrink-0">
          {user.fullName ? getInitials(user.fullName) : <User className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-heading font-semibold text-xs text-ink truncate leading-tight">
            {user.fullName}
          </p>
          <p className="font-body text-[11px] text-muted truncate">{user.email}</p>
        </div>
      </div>
      <button
        onClick={() => logout()}
        aria-label="Keluar akun"
        title="Keluar"
        className="p-1.5 rounded-btn hover:bg-surface border border-transparent hover:border-ink text-muted hover:text-danger transition-colors cursor-pointer shrink-0"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
