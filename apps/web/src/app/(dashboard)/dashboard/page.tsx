'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  RefreshCw,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { StatCard, Badge, Button, Card, CardHeader, CardTitle, CardContent } from '@rumahkita/ui';
import { formatIDR } from '@rumahkita/contracts';
import { apiFetch } from '@/lib/api-fetcher';
import { useHousehold } from '@/contexts/household-context';

interface DashboardData {
  period: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'CUSTOM';
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  openDebtsTotal?: number;
  openReceivablesTotal?: number;
  lowStockCount: number;
  outOfStockCount: number;
  recentTransactions: Array<{
    id: string;
    type: 'income' | 'expense';
    date: string;
    nominal: number;
    categoryOrSource: string;
    notes?: string | null;
  }>;
  lowStockItems: Array<{
    id: string;
    name: string;
    unit: string;
    quantityOnHand: number;
    lowStockThreshold: number;
    status: 'SAFE' | 'LOW' | 'OUT';
  }>;
  dueSoonDebts: Array<{
    id: string;
    type: 'payable' | 'receivable';
    partyName: string;
    remainingBalance: number;
    dueDate: string;
    status: string;
  }>;
}

export default function DashboardPage() {
  const { activeHousehold } = useHousehold();
  const [period, setPeriod] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'>('THIS_MONTH');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>(`/dashboard?period=${period.toLowerCase()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat ringkasan dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (activeHousehold) {
      fetchDashboard();
    }
  }, [activeHousehold, fetchDashboard]);

  const chartData = data
    ? [
        {
          name: 'Arus Kas',
          Pemasukan: data.totalIncome,
          Pengeluaran: data.totalExpense,
        },
      ]
    : [];

  const formatYAxisTick = (val: number) => {
    if (val === 0) return '0';
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}jt`;
    if (abs >= 1_000) return `${(val / 1_000).toFixed(0)}rb`;
    return String(val);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Ringkasan Keuangan & Stok
          </h1>
          <p className="text-xs sm:text-sm text-muted font-body mt-1">
            Pantau arus kas keluarga dan ketersediaan barang belanjaan rumah tangga.
          </p>
        </div>

        {/* Period Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="flex-1 sm:flex-initial min-h-[40px] bg-surface text-ink font-heading font-bold text-xs sm:text-sm border-2 border-ink rounded-btn px-3 py-2 shadow-neo-sm focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
          >
            <option value="THIS_MONTH">Bulan Ini</option>
            <option value="LAST_MONTH">Bulan Lalu</option>
            <option value="THIS_YEAR">Tahun Ini</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboard}
            disabled={isLoading}
            aria-label="Segarkan data"
            title="Segarkan data"
            className="shrink-0 min-h-[40px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Link href="/transaksi" className="shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="shrink-0 min-h-[40px]"
            >
              Transaksi
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-[#FEE2E2] border-neo border-danger rounded-card flex items-center justify-between gap-3 text-danger font-body text-xs sm:text-sm font-semibold shadow-neo-sm">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchDashboard} className="shrink-0">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-surface border-neo border-ink rounded-card p-5 h-32 animate-pulse space-y-3"
            >
              <div className="h-4 bg-ink/10 rounded w-1/2" />
              <div className="h-8 bg-ink/10 rounded w-3/4" />
              <div className="h-3 bg-ink/10 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* 4 Stat Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Pemasukan"
            value={formatIDR(data.totalIncome)}
            icon={<TrendingUp className="w-5 h-5 text-success" />}
            description={`Periode ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`}
          />
          <StatCard
            title="Total Pengeluaran"
            value={formatIDR(data.totalExpense)}
            icon={<TrendingDown className="w-5 h-5 text-danger" />}
            description="Termasuk pengeluaran belanja otomatis"
          />
          <StatCard
            title="Sisa Arus Kas"
            value={formatIDR(data.netCashFlow)}
            icon={<Wallet className="w-5 h-5 text-ink" />}
            badge={
              <Badge variant={data.netCashFlow >= 0 ? 'aman' : 'habis'} className="text-[10px] shrink-0">
                {data.netCashFlow >= 0 ? 'Surplus ✓' : 'Defisit ✕'}
              </Badge>
            }
            description="Pemasukan dikurangi pengeluaran"
          />
          <StatCard
            title="Perlu Belanja"
            value={`${data.lowStockCount + data.outOfStockCount} Barang`}
            icon={<AlertTriangle className="w-5 h-5 text-warning" />}
            badge={
              <Badge variant="menipis" className="text-[10px] shrink-0">
                {`${data.outOfStockCount} Habis · ${data.lowStockCount} Menipis`}
              </Badge>
            }
            description="Kebutuhan rumah di ambang batas"
          />
        </div>
      )}

      {/* Chart & Highlights Row */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recharts Bar Chart (2 cols on lg) */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Perbandingan Arus Kas</CardTitle>
                <p className="text-xs text-muted font-body mt-0.5">
                  Visualisasi rasio pemasukan versus pengeluaran kas periode ini.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-60 sm:h-72 w-full pt-2 sm:pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="name"
                      stroke="#171717"
                      fontFamily="Space Grotesk"
                      fontWeight={600}
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#171717"
                      fontFamily="Inter"
                      fontSize={10}
                      width={48}
                      tickFormatter={formatYAxisTick}
                    />
                    <Tooltip
                      formatter={(value: any) => [formatIDR(Number(value)), '']}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '2px solid #171717',
                        borderRadius: '8px',
                        boxShadow: '4px 4px 0px #171717',
                        fontFamily: 'Inter',
                        fontWeight: 600,
                      }}
                    />
                    <Legend wrapperStyle={{ fontFamily: 'Space Grotesk', fontWeight: 600 }} />
                    <Bar
                      dataKey="Pemasukan"
                      fill="#C8F169"
                      stroke="#171717"
                      strokeWidth={2}
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="Pengeluaran"
                      fill="#FF8A65"
                      stroke="#171717"
                      strokeWidth={2}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Warning Widget (1 col on lg) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base sm:text-lg">Kebutuhan Menipis</CardTitle>
              <Link
                href="/inventori"
                className="text-xs font-semibold text-ink hover:underline flex items-center gap-1"
              >
                Inventori <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.lowStockItems.length === 0 ? (
                <div className="p-4 py-6 sm:py-8 text-center bg-bg border border-ink/15 rounded-card">
                  <div className="w-10 h-10 rounded-full bg-[#D1FAE5] text-success border border-success flex items-center justify-center mx-auto mb-2">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="font-heading font-bold text-sm text-ink">Semua Stok Aman ✓</p>
                  <p className="text-xs text-muted font-body mt-1">
                    Belum ada barang belanjaan yang mencapai ambang batas minimum.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-ink/10">
                  {data.lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 truncate">
                        <p className="font-heading font-semibold text-sm text-ink truncate leading-tight">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted font-body mt-0.5 tabular-nums truncate">
                          Tersisa: {item.quantityOnHand} {item.unit} (Min: {item.lowStockThreshold})
                        </p>
                      </div>
                      <Badge variant={item.status === 'OUT' ? 'habis' : 'menipis'} className="shrink-0">
                        {item.status === 'OUT' ? 'Habis ✕' : 'Menipis ⚠'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {data.lowStockItems.length > 0 && (
                <Link href="/inventori" className="block pt-2">
                  <Button variant="outline" size="sm" className="w-full min-h-[44px] text-xs">
                    Kelola Stok di Inventori
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Row: Recent Transactions & Due Soon Debts */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base sm:text-lg">Transaksi Terbaru</CardTitle>
              <Link
                href="/transaksi"
                className="text-xs font-semibold text-ink hover:underline flex items-center gap-1"
              >
                Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentTransactions.length === 0 ? (
                <div className="p-4 py-6 sm:py-8 text-center bg-bg border border-ink/15 rounded-card">
                  <p className="font-heading font-bold text-sm text-ink">Belum Ada Transaksi</p>
                  <p className="text-xs text-muted font-body mt-1 mb-3">
                    Catat pengeluaran atau pemasukan pertama rumah tangga Anda.
                  </p>
                  <Link href="/transaksi">
                    <Button variant="primary" size="sm">
                      + Catat Transaksi
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-ink/10">
                  {data.recentTransactions.map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-btn border border-ink flex items-center justify-center shrink-0 ${
                            tx.type === 'income' ? 'bg-[#D1FAE5] text-success' : 'bg-[#FFE4E6] text-danger'
                          }`}
                        >
                          {tx.type === 'income' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 truncate">
                          <p className="font-heading font-semibold text-sm text-ink truncate leading-tight">
                            {tx.categoryOrSource}
                          </p>
                          <p className="text-xs text-muted font-body mt-0.5 truncate">
                            {formatDate(tx.date)} {tx.notes ? `• ${tx.notes}` : ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-heading font-bold tabular-nums shrink-0 text-xs sm:text-sm md:text-base text-right ${
                          tx.type === 'income' ? 'text-success' : 'text-ink'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'} {formatIDR(tx.nominal)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Due Soon Debts & Receivables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base sm:text-lg">Jatuh Tempo Hutang & Piutang</CardTitle>
              <Link
                href="/hutang"
                className="text-xs font-semibold text-ink hover:underline flex items-center gap-1"
              >
                Kelola Hutang <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {data.dueSoonDebts.length === 0 ? (
                <div className="p-4 py-6 sm:py-8 text-center bg-bg border border-ink/15 rounded-card">
                  <div className="w-10 h-10 rounded-full bg-[#D1FAE5] text-success border border-success flex items-center justify-center mx-auto mb-2">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="font-heading font-bold text-sm text-ink">Tidak Ada Tagihan Dekat</p>
                  <p className="text-xs text-muted font-body mt-1">
                    Semua kewajiban hutang dan hak piutang aman dan terkendali.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-ink/10">
                  {data.dueSoonDebts.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-heading font-bold text-sm text-ink truncate leading-tight min-w-0">
                            {item.partyName}
                          </span>
                          <Badge
                            variant={item.type === 'payable' ? 'habis' : 'secondary'}
                            className="text-[9px] px-1.5 py-0 shrink-0"
                          >
                            {item.type === 'payable' ? 'Hutang' : 'Piutang'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted font-body mt-0.5 truncate">
                          Jatuh tempo: {formatDate(item.dueDate)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-heading font-bold text-xs sm:text-sm md:text-base tabular-nums text-ink block text-right">
                          {formatIDR(item.remainingBalance)}
                        </span>
                        <span className="text-[11px] text-muted font-body">Sisa saldo</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
