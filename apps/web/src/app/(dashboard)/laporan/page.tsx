'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  PieChart as PieIcon,
  Check,
  AlertCircle,
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
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { formatIDR, MonthlyReportResponse, YearlyReportResponse } from '@rumahkita/contracts';
import { apiFetch } from '@/lib/api-fetcher';
import { useHousehold } from '@/contexts/household-context';

const monthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export default function LaporanPage() {
  const { activeHousehold } = useHousehold();
  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly'>('monthly');

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const [monthlyData, setMonthlyData] = useState<MonthlyReportResponse | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CSV Export Modal state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvType, setCsvType] = useState<'transactions' | 'expenses' | 'incomes'>('transactions');
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'monthly') {
        const res = await apiFetch<MonthlyReportResponse>(
          `/reports/monthly?year=${selectedYear}&month=${selectedMonth}`
        );
        setMonthlyData(res);
      } else {
        const res = await apiFetch<YearlyReportResponse>(
          `/reports/yearly?year=${selectedYear}`
        );
        setYearlyData(res);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data laporan keuangan');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedYear, selectedMonth]);

  useEffect(() => {
    if (activeHousehold) {
      fetchReport();
    }
  }, [activeHousehold, fetchReport]);

  // CSV Download Handler
  const handleDownloadCsv = async () => {
    setIsExporting(true);
    try {
      let url = `/reports/export/csv?type=${csvType}`;
      if (activeTab === 'monthly') {
        const m = String(selectedMonth).padStart(2, '0');
        const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        url += `&startDate=${selectedYear}-${m}-01&endDate=${selectedYear}-${m}-${lastDay}`;
      } else {
        url += `&startDate=${selectedYear}-01-01&endDate=${selectedYear}-12-31`;
      }

      const csvText = await apiFetch<string>(url);

      // Create browser blob trigger
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute(
        'download',
        `laporan-rumahkita-${csvType}-${selectedYear}${activeTab === 'monthly' ? `-${selectedMonth}` : ''}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setCsvModalOpen(false);
      setNotification({ type: 'success', message: 'File CSV berhasil diunduh!' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal mengunduh file CSV' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Laporan Keuangan & Analisis
          </h1>
          <p className="text-xs sm:text-sm text-muted font-body mt-1">
            Analisis arus kas bulanan dan tahunan rumah tangga serta ekspor ke format CSV.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={() => setCsvModalOpen(true)}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Unduh CSV
          </Button>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {notification && (
        <div
          className={`p-3.5 border-2 rounded-btn flex items-center justify-between text-xs font-semibold font-body shadow-neo-sm ${
            notification.type === 'success'
              ? 'bg-[#D1FAE5] border-[#065F46] text-[#065F46]'
              : 'bg-[#FEE2E2] border-danger text-danger'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="underline font-bold text-[11px] cursor-pointer ml-3"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-[#FEE2E2] border-neo border-danger rounded-card flex items-center justify-between gap-3 text-danger font-body text-xs sm:text-sm font-semibold shadow-neo-sm">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchReport} className="shrink-0">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* View Switcher & Period Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
        {/* Dual Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-bg border border-ink/20 rounded-btn">
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'monthly'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Laporan Bulanan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('yearly')}
            className={`px-3 py-1.5 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'yearly'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Laporan Tahunan
          </button>
        </div>

        {/* Date Selectors */}
        <div className="flex items-center gap-2">
          {activeTab === 'monthly' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="bg-bg text-ink font-heading font-bold text-xs border border-ink/30 rounded-btn px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="bg-bg text-ink font-heading font-bold text-xs border border-ink/30 rounded-btn px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchReport}
            disabled={isLoading}
            aria-label="Segarkan laporan"
            title="Segarkan laporan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-surface border-neo border-ink rounded-card p-5 h-28 animate-pulse space-y-2"
            >
              <div className="h-4 bg-ink/10 rounded w-1/2" />
              <div className="h-7 bg-ink/10 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* MONTHLY REPORT VIEW */}
      {!isLoading && activeTab === 'monthly' && monthlyData && (
        <div className="space-y-6">
          {/* 3 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Pemasukan Bulanan"
              value={formatIDR(monthlyData.totalIncome)}
              icon={<TrendingUp className="w-5 h-5 text-success" />}
              description={`${monthNames[monthlyData.month - 1]} ${monthlyData.year}`}
            />
            <StatCard
              title="Total Pengeluaran Bulanan"
              value={formatIDR(monthlyData.totalExpense)}
              icon={<TrendingDown className="w-5 h-5 text-danger" />}
              description="Termasuk seluruh pos pengeluaran"
            />
            <StatCard
              title="Sisa Arus Kas Bersih"
              value={formatIDR(monthlyData.netCashFlow)}
              icon={<Wallet className="w-5 h-5 text-ink" />}
              badge={
                <Badge variant={monthlyData.netCashFlow >= 0 ? 'aman' : 'habis'} className="text-[10px]">
                  {monthlyData.netCashFlow >= 0 ? 'Surplus ✓' : 'Defisit ✕'}
                </Badge>
              }
              description="Pemasukan minus pengeluaran"
            />
          </div>

          {/* Daily Cash Flow Trend BarChart */}
          <Card>
            <CardHeader>
              <CardTitle>Tren Arus Kas Harian</CardTitle>
              <p className="text-xs text-muted font-body mt-0.5">
                Pemasukan dan pengeluaran harian sepanjang bulan {monthNames[monthlyData.month - 1]}{' '}
                {monthlyData.year}.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData.dailyTrend}
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="date"
                      stroke="#171717"
                      fontFamily="Inter"
                      fontSize={10}
                      tickFormatter={(val) => val.split('-')[2] || val}
                    />
                    <YAxis
                      stroke="#171717"
                      fontFamily="Inter"
                      fontSize={11}
                      tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}rb`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatIDR(Number(val)), '']}
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
                    <Bar dataKey="income" name="Pemasukan" fill="#C8F169" stroke="#171717" strokeWidth={1.5} />
                    <Bar dataKey="expense" name="Pengeluaran" fill="#FF8A65" stroke="#171717" strokeWidth={1.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown Tables Row: Expense by Category & Income by Source */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense By Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Pengeluaran per Kategori</CardTitle>
                <p className="text-xs text-muted font-body mt-0.5">
                  Rincian alokasi anggaran belanja rumah tangga.
                </p>
              </CardHeader>
              <CardContent>
                {monthlyData.expenseByCategory.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Belum ada pengeluaran pada bulan ini.</p>
                ) : (
                  <div className="divide-y divide-ink/15 border-2 border-ink rounded-btn overflow-hidden bg-surface">
                    {monthlyData.expenseByCategory.map((cat) => (
                      <div key={cat.categoryId} className="p-3 flex items-center justify-between text-xs font-body">
                        <div>
                          <span className="font-heading font-bold text-sm text-ink block">{cat.categoryName}</span>
                          <span className="text-[11px] text-muted">Porsi: {cat.percentage.toFixed(1)}% dari total</span>
                        </div>
                        <span className="font-heading font-bold text-sm tabular-nums text-ink">
                          {formatIDR(cat.nominal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Income By Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Pemasukan per Sumber</CardTitle>
                <p className="text-xs text-muted font-body mt-0.5">
                  Rincian kontribusi sumber pendapatan keluarga.
                </p>
              </CardHeader>
              <CardContent>
                {monthlyData.incomeBySource.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Belum ada pemasukan pada bulan ini.</p>
                ) : (
                  <div className="divide-y divide-ink/15 border-2 border-ink rounded-btn overflow-hidden bg-surface">
                    {monthlyData.incomeBySource.map((src) => (
                      <div key={src.sourceId} className="p-3 flex items-center justify-between text-xs font-body">
                        <div>
                          <span className="font-heading font-bold text-sm text-ink block">{src.sourceName}</span>
                          <span className="text-[11px] text-muted">Porsi: {src.percentage.toFixed(1)}% dari total</span>
                        </div>
                        <span className="font-heading font-bold text-sm tabular-nums text-success">
                          {formatIDR(src.nominal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* YEARLY REPORT VIEW (With 12-Month Zero Continuity Guarantee) */}
      {!isLoading && activeTab === 'yearly' && yearlyData && (
        <div className="space-y-6">
          {/* 3 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Pemasukan Tahunan"
              value={formatIDR(yearlyData.totalIncome)}
              icon={<TrendingUp className="w-5 h-5 text-success" />}
              description={`Tahun ${yearlyData.year}`}
            />
            <StatCard
              title="Total Pengeluaran Tahunan"
              value={formatIDR(yearlyData.totalExpense)}
              icon={<TrendingDown className="w-5 h-5 text-danger" />}
              description="Seluruh pengeluaran 12 bulan"
            />
            <StatCard
              title="Akumulasi Kas Bersih"
              value={formatIDR(yearlyData.netCashFlow)}
              icon={<Wallet className="w-5 h-5 text-ink" />}
              badge={
                <Badge variant={yearlyData.netCashFlow >= 0 ? 'aman' : 'habis'} className="text-[10px]">
                  {yearlyData.netCashFlow >= 0 ? 'Surplus ✓' : 'Defisit ✕'}
                </Badge>
              }
              description="Net akumulatif tahun ini"
            />
          </div>

          {/* 12-Month Zero-Continuity Grouped Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Arus Kas Bulanan 12 Bulan (Tahun {yearlyData.year})</CardTitle>
              <p className="text-xs text-muted font-body mt-0.5">
                Perbandingan pemasukan vs pengeluaran setiap bulan tanpa jeda terputus (zero-month continuity).
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-72 sm:h-80 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={yearlyData.monthlyTrend}
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis
                      dataKey="monthName"
                      stroke="#171717"
                      fontFamily="Space Grotesk"
                      fontWeight={600}
                      fontSize={11}
                    />
                    <YAxis
                      stroke="#171717"
                      fontFamily="Inter"
                      fontSize={11}
                      tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(0)}jt`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatIDR(Number(val)), '']}
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
                      dataKey="income"
                      name="Pemasukan"
                      fill="#C8F169"
                      stroke="#171717"
                      strokeWidth={1.5}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expense"
                      name="Pengeluaran"
                      fill="#FF8A65"
                      stroke="#171717"
                      strokeWidth={1.5}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 12-Month Table Breakdown */}
          <div className="bg-surface border-neo border-ink rounded-card shadow-neo overflow-hidden">
            <div className="p-4 border-b-neo border-ink bg-bg">
              <h3 className="font-heading font-bold text-base text-ink">
                Rincian Arus Kas Per Bulan (12 Bulan)
              </h3>
            </div>
            <table className="w-full text-left text-sm font-body">
              <thead className="bg-bg border-b-neo border-ink font-heading text-xs uppercase tracking-wider text-ink font-bold">
                <tr>
                  <th className="py-3 px-4">Bulan</th>
                  <th className="py-3 px-4 text-right">Pemasukan</th>
                  <th className="py-3 px-4 text-right">Pengeluaran</th>
                  <th className="py-3 px-4 text-right">Arus Kas Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/15">
                {yearlyData.monthlyTrend.map((m) => (
                  <tr key={m.month} className="hover:bg-bg/40 transition-colors">
                    <td className="py-3 px-4 font-heading font-bold text-ink text-xs">
                      {m.monthName}
                    </td>
                    <td className="py-3 px-4 text-right font-heading font-semibold text-xs tabular-nums text-success">
                      {formatIDR(m.income)}
                    </td>
                    <td className="py-3 px-4 text-right font-heading font-semibold text-xs tabular-nums text-ink">
                      {formatIDR(m.expense)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-heading font-bold text-xs tabular-nums ${
                        m.net >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {formatIDR(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV Export Dialog */}
      <Dialog open={csvModalOpen} onOpenChange={setCsvModalOpen} title="Unduh Laporan Format CSV" maxWidth="md">
        <div className="space-y-4">
          <p className="text-xs font-body text-muted">
            Ekspor data transaksi keuangan RumahKita ke file CSV (standar RFC 4180) yang kompatibel dengan
            Microsoft Excel dan Google Sheets.
          </p>

          <Select
            label="Pilih Jenis Data"
            value={csvType}
            onChange={(e) => setCsvType(e.target.value as any)}
          >
            <option value="transactions">Semua Transaksi (Pemasukan & Pengeluaran)</option>
            <option value="expenses">Hanya Pengeluaran</option>
            <option value="incomes">Hanya Pemasukan</option>
          </Select>

          <div className="p-3 bg-bg border border-ink/20 rounded-btn text-xs font-body">
            <span className="text-muted block">Rentang Waktu:</span>
            <span className="font-bold text-ink">
              {activeTab === 'monthly'
                ? `Bulan ${monthNames[selectedMonth - 1]} ${selectedYear}`
                : `Tahun Penuh ${selectedYear} (12 Bulan)`}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setCsvModalOpen(false)}
              disabled={isExporting}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleDownloadCsv}
              isLoading={isExporting}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Unduh File CSV
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
