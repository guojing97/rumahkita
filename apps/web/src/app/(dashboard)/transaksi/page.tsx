'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Trash2,
  Calendar,
  Filter,
  ArrowUpDown,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createIncomeSchema,
  CreateIncomeInput,
  createExpenseSchema,
  CreateExpenseInput,
  formatIDR,
} from '@rumahkita/contracts';
import { Button, Input, Badge, Card, CardHeader, CardTitle, CardContent } from '@rumahkita/ui';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { IDRInput } from '@/components/ui/idr-input';
import { apiFetch } from '@/lib/api-fetcher';
import { useHousehold } from '@/contexts/household-context';

interface UnifiedTransaction {
  id: string;
  type: 'income' | 'expense';
  date: string;
  nominal: number;
  categoryName: string;
  sourceName?: string;
  paymentMethod?: string;
  notes?: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default function TransaksiPage() {
  const { activeHousehold } = useHousehold();
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all');
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryOption[]>([]);
  const [incomeSources, setIncomeSources] = useState<CategoryOption[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);

  // Server-side pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<UnifiedTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch master options
  const fetchMasterData = useCallback(async () => {
    try {
      const [expCatRes, incSrcRes, incCatRes] = await Promise.all([
        apiFetch<any>('/expense-categories').catch(() => []),
        apiFetch<any>('/income-sources').catch(() => []),
        apiFetch<any>('/income-categories').catch(() => []),
      ]);
      setExpenseCategories(Array.isArray(expCatRes) ? expCatRes : expCatRes.data || []);
      setIncomeSources(Array.isArray(incSrcRes) ? incSrcRes : incSrcRes.data || []);
      setIncomeCategories(Array.isArray(incCatRes) ? incCatRes : incCatRes.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeHousehold) {
      fetchMasterData();
    }
  }, [activeHousehold, fetchMasterData]);

  // Fetch transactions with fallback support
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));
      if (activeTab !== 'all') {
        queryParams.set('type', activeTab);
      }
      if (searchQuery.trim()) {
        queryParams.set('search', searchQuery.trim());
      }

      let txList: UnifiedTransaction[] = [];
      let metaTotal = 0;
      let metaPages = 1;
      let successWithTransactions = false;

      // Try /transactions endpoint
      try {
        const txRes = await apiFetch<any>(`/transactions?${queryParams.toString()}`);
        if (txRes && (Array.isArray(txRes) || txRes.data)) {
          const raw = Array.isArray(txRes) ? txRes : txRes.data || [];
          txList = raw.map((item: any) => ({
            id: item.id,
            type: item.type,
            date: item.date,
            nominal: item.nominal,
            categoryName:
              item.categoryName ||
              item.category?.name ||
              (item.type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
            sourceName: item.sourceName || item.source?.name,
            paymentMethod: item.paymentMethod,
            notes: item.notes,
          }));
          metaTotal = txRes.meta?.total ?? txList.length;
          metaPages = txRes.meta?.totalPages ?? (Math.ceil(metaTotal / limit) || 1);
          successWithTransactions = true;
        }
      } catch {
        successWithTransactions = false;
      }

      // Fallback query to /incomes and /expenses if /transactions is unavailable
      if (!successWithTransactions) {
        if (activeTab === 'expense') {
          const expRes = await apiFetch<any>(`/expenses?${queryParams.toString()}`);
          const rawExpenses = Array.isArray(expRes) ? expRes : expRes.data || [];
          txList = rawExpenses.map((item: any) => ({
            id: item.id,
            type: 'expense' as const,
            date: item.date,
            nominal: item.nominal,
            categoryName: item.category?.name || 'Pengeluaran',
            paymentMethod: item.paymentMethod,
            notes: item.notes,
          }));
          metaTotal = expRes?.meta?.total ?? txList.length;
          metaPages = expRes?.meta?.totalPages ?? (Math.ceil(metaTotal / limit) || 1);
        } else if (activeTab === 'income') {
          const incRes = await apiFetch<any>(`/incomes?${queryParams.toString()}`);
          const rawIncomes = Array.isArray(incRes) ? incRes : incRes.data || [];
          txList = rawIncomes.map((item: any) => ({
            id: item.id,
            type: 'income' as const,
            date: item.date,
            nominal: item.nominal,
            categoryName: item.category?.name || 'Pemasukan',
            sourceName: item.source?.name || 'Sumber Lain',
            notes: item.notes,
          }));
          metaTotal = incRes?.meta?.total ?? txList.length;
          metaPages = incRes?.meta?.totalPages ?? (Math.ceil(metaTotal / limit) || 1);
        } else {
          // activeTab === 'all': fetch both with search filter, merge and paginate
          const [incomesRes, expensesRes] = await Promise.all([
            apiFetch<any>(
              `/incomes?limit=100${searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : ''}`
            ).catch(() => ({ data: [] })),
            apiFetch<any>(
              `/expenses?limit=100${searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : ''}`
            ).catch(() => ({ data: [] })),
          ]);

          const rawIncomes = Array.isArray(incomesRes) ? incomesRes : incomesRes.data || [];
          const rawExpenses = Array.isArray(expensesRes) ? expensesRes : expensesRes.data || [];

          const mappedIncomes: UnifiedTransaction[] = rawIncomes.map((item: any) => ({
            id: item.id,
            type: 'income',
            date: item.date,
            nominal: item.nominal,
            categoryName: item.category?.name || 'Pemasukan',
            sourceName: item.source?.name || 'Sumber Lain',
            notes: item.notes,
          }));

          const mappedExpenses: UnifiedTransaction[] = rawExpenses.map((item: any) => ({
            id: item.id,
            type: 'expense',
            date: item.date,
            nominal: item.nominal,
            categoryName: item.category?.name || 'Pengeluaran',
            paymentMethod: item.paymentMethod,
            notes: item.notes,
          }));

          const merged = [...mappedIncomes, ...mappedExpenses].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          metaTotal = merged.length;
          metaPages = Math.ceil(metaTotal / limit) || 1;
          const offset = (page - 1) * limit;
          txList = merged.slice(offset, offset + limit);
        }
      }

      setTransactions(txList);
      setTotalCount(metaTotal);
      setTotalPages(metaPages);
    } catch {
      setNotification({ type: 'error', message: 'Gagal memuat data transaksi' });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, activeTab, searchQuery]);

  useEffect(() => {
    if (activeHousehold) {
      fetchData();
    }
  }, [activeHousehold, fetchData]);

  const from = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalCount);

  // Totals for current transactions view
  const totalIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income')
        .reduce((acc, curr) => acc + curr.nominal, 0),
    [transactions]
  );

  const totalExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((acc, curr) => acc + curr.nominal, 0),
    [transactions]
  );

  // TanStack Table Column Definitions
  const columns = useMemo<ColumnDef<UnifiedTransaction>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-ink"
          >
            <span>Tanggal</span>
            <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          </button>
        ),
        cell: (info) => (
          <span className="text-xs font-semibold text-muted tabular-nums">
            {new Date(info.getValue() as string).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Tipe',
        cell: (info) => {
          const type = info.getValue() as string;
          return (
            <Badge variant={type === 'income' ? 'aman' : 'habis'} className="text-[11px]">
              {type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'categoryName',
        header: 'Kategori / Sumber',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <span className="font-heading font-bold text-xs text-ink block">
                {row.type === 'income' ? row.sourceName || row.categoryName : row.categoryName}
              </span>
              {row.paymentMethod && (
                <span className="text-[10px] text-muted font-body uppercase">
                  Metode: {row.paymentMethod}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'notes',
        header: 'Catatan',
        cell: (info) => (
          <span className="text-xs font-body text-ink truncate max-w-xs block">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'nominal',
        header: ({ column }) => (
          <div className="text-right">
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="inline-flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-ink"
            >
              <span>Nominal</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
            </button>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div
              className={`text-right font-heading font-bold text-sm tabular-nums ${
                row.type === 'income' ? 'text-success' : 'text-ink'
              }`}
            >
              {row.type === 'income' ? '+' : '-'} {formatIDR(row.nominal)}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-center">Aksi</div>,
        cell: (info) => (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setItemToDelete(info.row.original)}
              aria-label="Hapus transaksi"
              className="p-1.5 rounded-btn text-muted hover:text-danger hover:bg-[#FEE2E2] border border-transparent hover:border-danger transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const endpoint =
        itemToDelete.type === 'income' ? `/incomes/${itemToDelete.id}` : `/expenses/${itemToDelete.id}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      setNotification({ type: 'success', message: 'Transaksi berhasil dihapus' });
      setItemToDelete(null);
      fetchData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal menghapus transaksi' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Primary CTAs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Transaksi Keuangan
          </h1>
          <p className="text-xs sm:text-sm text-muted font-body mt-1">
            Catat dan pantau seluruh arus masuk dan keluar kas rumah tangga.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIncomeModalOpen(true)}
            leftIcon={<ArrowDownLeft className="w-4 h-4 text-success" />}
          >
            + Pemasukan
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => setExpenseModalOpen(true)}
            leftIcon={<ArrowUpRight className="w-4 h-4 text-danger" />}
          >
            + Pengeluaran
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

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-1 bg-surface border-neo border-ink rounded-btn shadow-neo-sm w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('expense');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'expense'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('income');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'income'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Pemasukan
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari transaksi / catatan..."
            className="w-full bg-surface text-ink border-neo border-ink rounded-btn h-10 pl-9 pr-3 text-xs font-body focus:outline-none focus:ring-2 focus:ring-secondary shadow-neo-sm"
          />
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
          <span className="text-[11px] font-semibold text-muted font-body block uppercase">
            Total Pengeluaran
          </span>
          <span className="font-heading font-bold text-lg sm:text-xl text-ink tabular-nums mt-0.5 block">
            {formatIDR(totalExpense)}
          </span>
        </div>
        <div className="p-3.5 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
          <span className="text-[11px] font-semibold text-muted font-body block uppercase">
            Total Pemasukan
          </span>
          <span className="font-heading font-bold text-lg sm:text-xl text-success tabular-nums mt-0.5 block">
            {formatIDR(totalIncome)}
          </span>
        </div>
        <div className="p-3.5 bg-surface border-neo border-ink rounded-card shadow-neo-sm col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-muted font-body block uppercase">
            Arus Kas Bersih
          </span>
          <span
            className={`font-heading font-bold text-lg sm:text-xl tabular-nums mt-0.5 block ${
              totalIncome - totalExpense >= 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {formatIDR(totalIncome - totalExpense)}
          </span>
        </div>
      </div>

      {/* DESKTOP TABLE VIEW (>= 768px) */}
      <div className="hidden md:block bg-surface border-neo border-ink rounded-card shadow-neo overflow-hidden">
        <table className="w-full text-left text-sm font-body">
          <thead className="bg-bg border-b-neo border-ink">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="py-3 px-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-ink/15">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted font-body text-xs">
                  Memuat transaksi...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted font-body text-xs">
                  Belum ada transaksi ditemukan untuk kriteria ini.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-bg/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE STACKED CARD LIST (< 768px, 390px base) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-6 text-center text-muted text-xs">Memuat transaksi...</div>
        ) : transactions.length === 0 ? (
          <div className="p-6 text-center bg-surface border-neo border-ink rounded-card shadow-neo text-muted text-xs">
            Belum ada transaksi ditemukan.
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-surface border-neo border-ink rounded-card shadow-neo p-4 flex flex-col gap-2.5 active:bg-bg/40 transition-colors"
            >
              {/* Top Row: Badge & Date */}
              <div className="flex items-center justify-between">
                <Badge variant={tx.type === 'income' ? 'aman' : 'habis'} className="text-[10px]">
                  {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                </Badge>
                <span className="text-[11px] font-semibold text-muted font-body tabular-nums">
                  {new Date(tx.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Middle Row: Category / Source & Notes */}
              <div>
                <p className="font-heading font-bold text-sm text-ink leading-tight">
                  {tx.type === 'income' ? tx.sourceName || tx.categoryName : tx.categoryName}
                </p>
                {tx.notes && <p className="text-xs text-muted font-body mt-0.5">{tx.notes}</p>}
                {tx.paymentMethod && (
                  <p className="text-[10px] text-muted font-body uppercase mt-0.5">
                    Metode: {tx.paymentMethod}
                  </p>
                )}
              </div>

              {/* Bottom Row: Nominal & Action */}
              <div className="flex items-center justify-between pt-2 border-t border-ink/10">
                <span
                  className={`font-heading font-bold text-base tabular-nums ${
                    tx.type === 'income' ? 'text-success' : 'text-ink'
                  }`}
                >
                  {tx.type === 'income' ? '+' : '-'} {formatIDR(tx.nominal)}
                </span>
                <button
                  type="button"
                  onClick={() => setItemToDelete(tx)}
                  aria-label="Hapus transaksi"
                  className="p-2 text-danger hover:bg-[#FEE2E2] rounded-btn min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PAGINATION BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
        <span className="text-xs font-semibold text-muted font-body">
          Menampilkan {from} - {to} dari {totalCount} transaksi
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoading}
            className="text-xs"
          >
            Sebelumnya
          </Button>

          <span className="text-xs font-heading font-bold text-ink px-2 tabular-nums">
            Halaman {page} dari {totalPages || 1}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => (page < totalPages ? prev + 1 : prev))}
            disabled={page >= totalPages || isLoading}
            className="text-xs"
          >
            Berikutnya
          </Button>
        </div>
      </div>

      {/* MODAL 1: Catat Pemasukan */}
      <IncomeModal
        open={incomeModalOpen}
        onOpenChange={setIncomeModalOpen}
        incomeSources={incomeSources}
        incomeCategories={incomeCategories}
        onSuccess={() => {
          setIncomeModalOpen(false);
          setNotification({ type: 'success', message: 'Pemasukan berhasil dicatat!' });
          fetchData();
        }}
      />

      {/* MODAL 2: Catat Pengeluaran */}
      <ExpenseModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
        expenseCategories={expenseCategories}
        onSuccess={() => {
          setExpenseModalOpen(false);
          setNotification({ type: 'success', message: 'Pengeluaran berhasil dicatat!' });
          fetchData();
        }}
      />

      {/* DIALOG 3: Konfirmasi Hapus Transaksi */}
      <Dialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Hapus Catatan Transaksi"
        maxWidth="md"
      >
        {itemToDelete && (
          <div className="space-y-4">
            <p className="text-sm font-body text-ink">
              Apakah Anda yakin ingin menghapus catatan{' '}
              <strong>{itemToDelete.type === 'income' ? 'pemasukan' : 'pengeluaran'}</strong> sebesar{' '}
              <strong className="text-danger">{formatIDR(itemToDelete.nominal)}</strong>? Tindakan
              ini akan memperbarui perhitungan laporan keuangan.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
              <Button
                variant="outline"
                size="md"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                size="md"
                onClick={handleDeleteConfirm}
                isLoading={isDeleting}
              >
                Hapus Transaksi
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// Subcomponent: Modal Catat Pemasukan
function IncomeModal({
  open,
  onOpenChange,
  incomeSources,
  incomeCategories,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incomeSources: CategoryOption[];
  incomeCategories: CategoryOption[];
  onSuccess: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateIncomeInput>({
    resolver: zodResolver(createIncomeSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      nominal: 0,
      sourceId: incomeSources[0]?.id || '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open && incomeSources.length > 0) {
      reset({
        date: new Date().toISOString().split('T')[0],
        nominal: 0,
        sourceId: incomeSources[0]?.id || '',
        notes: '',
      });
      setSubmitError(null);
    }
  }, [open, incomeSources, reset]);

  const onSubmit = async (data: CreateIncomeInput) => {
    setSubmitError(null);
    try {
      await apiFetch('/incomes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menyimpan catatan pemasukan');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Catat Pemasukan Kas">
      {submitError && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-danger text-danger text-xs font-semibold rounded-btn">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="income-date"
          label="Tanggal Transaksi"
          type="date"
          required
          error={errors.date?.message}
          {...register('date')}
        />

        <Controller
          name="nominal"
          control={control}
          render={({ field }) => (
            <IDRInput
              id="income-nominal"
              label="Nominal Pemasukan"
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.nominal?.message}
            />
          )}
        />

        <Select
          id="income-sourceId"
          label="Sumber Pendapatan"
          required
          error={errors.sourceId?.message}
          {...register('sourceId')}
        >
          {incomeSources.map((src) => (
            <option key={src.id} value={src.id}>
              {src.name}
            </option>
          ))}
        </Select>

        {incomeCategories.length > 0 && (
          <Select
            id="income-categoryId"
            label="Kategori Pemasukan (Opsional)"
            {...register('categoryId')}
          >
            <option value="">Pilih Kategori...</option>
            {incomeCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        )}

        <Input
          id="income-notes"
          label="Catatan (Opsional)"
          placeholder="Contoh: Gaji bulanan, bonus proyek..."
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            Simpan Pemasukan
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Subcomponent: Modal Catat Pengeluaran
function ExpenseModal({
  open,
  onOpenChange,
  expenseCategories,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseCategories: CategoryOption[];
  onSuccess: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      nominal: 0,
      categoryId: expenseCategories[0]?.id || '',
      paymentMethod: 'cash',
      notes: '',
    },
  });

  useEffect(() => {
    if (open && expenseCategories.length > 0) {
      reset({
        date: new Date().toISOString().split('T')[0],
        nominal: 0,
        categoryId: expenseCategories[0]?.id || '',
        paymentMethod: 'cash',
        notes: '',
      });
      setSubmitError(null);
    }
  }, [open, expenseCategories, reset]);

  const onSubmit = async (data: CreateExpenseInput) => {
    setSubmitError(null);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      onSuccess();
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menyimpan catatan pengeluaran');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Catat Pengeluaran Kas">
      {submitError && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-danger text-danger text-xs font-semibold rounded-btn">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="expense-date"
          label="Tanggal Transaksi"
          type="date"
          required
          error={errors.date?.message}
          {...register('date')}
        />

        <Controller
          name="nominal"
          control={control}
          render={({ field }) => (
            <IDRInput
              id="expense-nominal"
              label="Nominal Pengeluaran"
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.nominal?.message}
            />
          )}
        />

        <Select
          id="expense-categoryId"
          label="Kategori Pengeluaran"
          required
          error={errors.categoryId?.message}
          {...register('categoryId')}
        >
          {expenseCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>

        <Select
          id="expense-paymentMethod"
          label="Metode Pembayaran"
          required
          error={errors.paymentMethod?.message}
          {...register('paymentMethod')}
        >
          <option value="cash">Tunai (Cash)</option>
          <option value="transfer">Transfer Bank</option>
          <option value="ewallet">E-Wallet (GoPay, OVO, ShopeePay)</option>
          <option value="other">Lainnya</option>
        </Select>

        <Input
          id="expense-notes"
          label="Catatan (Opsional)"
          placeholder="Contoh: Belanja di Superindo, tagihan listrik PLN..."
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            Simpan Pengeluaran
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
