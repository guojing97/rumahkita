'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-btn bg-primary border-neo border-ink shadow-neo animate-bounce flex items-center justify-center font-heading font-bold text-lg text-ink mb-4">
          RK
        </div>
        <p className="font-heading font-bold text-sm text-ink">Memuat RumahKita...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      {/* Desktop Sidebar (>= 1024px) */}
      <DesktopSidebar />

      {/* Mobile Top Bar (< 1024px) */}
      <MobileTopBar />

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-60">
        {/* Mobile pb-24 reserves 96px for fixed bottom nav; desktop pb-12 */}
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav (< 1024px) */}
      <MobileBottomNav />
    </div>
  );
}
