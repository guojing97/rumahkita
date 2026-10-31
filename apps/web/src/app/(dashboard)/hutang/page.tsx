'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  HandCoins,
  Plus,
  ArrowUpDown,
  Search,
  Check,
  AlertTriangle,
  History,
  Trash2,
  Calendar,
  CreditCard,
  AlertCircle,
  Clock,
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
  createDebtReceivableSchema,
  CreateDebtReceivableInput,
  recordPaymentSchema,
  RecordPaymentInput,
  DebtType,
  DebtStatus,
  debtStatusLabels,
  formatIDR,
} from '@rumahkita/contracts';
import { Button, Input, Badge, Card, CardHeader, CardTitle, CardContent } from '@rumahkita/ui';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { IDRInput } from '@/components/ui/idr-input';
import { apiFetch } from '@/lib/api-fetcher';
import { useHousehold } from '@/contexts/household-context';

interface DebtPayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
}

interface DebtItem {
  id: string;
  type: DebtType;
  partyName: string;
  description?: string | null;
  principalAmount: number;
  remainingBalance: number;
  dueDate?: string | null;
  status: DebtStatus;
  notes?: string | null;
  payments?: DebtPayment[];
}

export default function HutangPage() {
  const { activeHousehold } = useHousehold();
  const [activeTab, setActiveTab] = useState<DebtType>('payable');
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'partyName', desc: false }]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<DebtItem | null>(null);
  const [historyTarget, setHistoryTarget] = useState<DebtItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DebtItem | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDebts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<any>('/debts-receivables?limit=100');
      const list = Array.isArray(res) ? res : res.data || [];
      setDebts(list);
    } catch {
      setNotification({ type: 'error', message: 'Gagal memuat data hutang & piutang' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeHousehold) {
      fetchDebts();
    }
  }, [activeHousehold, fetchDebts]);

  // Tab and search filtering
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (d.type !== activeTab) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const partyMatch = d.partyName.toLowerCase().includes(q);
        const descMatch = d.description?.toLowerCase().includes(q);
        const notesMatch = d.notes?.toLowerCase().includes(q);
        if (!partyMatch && !descMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [debts, activeTab, searchQuery]);

  // Tab Summary Totals
  const totalRemaining = useMemo(
    () => filteredDebts.reduce((acc, curr) => acc + curr.remainingBalance, 0),
    [filteredDebts]
  );

  const totalPrincipal = useMemo(
    () => filteredDebts.reduce((acc, curr) => acc + curr.principalAmount, 0),
    [filteredDebts]
  );

  const overdueCount = useMemo(
    () => filteredDebts.filter((d) => d.status === 'overdue').length,
    [filteredDebts]
  );

  const openCount = useMemo(
    () => filteredDebts.filter((d) => d.status === 'open' || d.status === 'partially_paid').length,
    [filteredDebts]
  );

  // TanStack Table Column Definitions
  const columns = useMemo<ColumnDef<DebtItem>[]>(
    () => [
      {
        accessorKey: 'partyName',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-ink"
          >
            <span>Pihak Terkait</span>
            <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          </button>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <span className="font-heading font-bold text-sm text-ink block">{row.partyName}</span>
              {row.description && (
                <span className="text-xs text-muted font-body mt-0.5 block">{row.description}</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'principalAmount',
        header: () => <div className="text-right">Nominal Pokok</div>,
        cell: (info) => (
          <div className="text-right text-xs font-semibold text-muted tabular-nums">
            {formatIDR(info.getValue() as number)}
          </div>
        ),
      },
      {
        accessorKey: 'remainingBalance',
        header: ({ column }) => (
          <div className="text-right">
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="inline-flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-ink"
            >
              <span>Sisa Saldo</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
            </button>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const paid = row.principalAmount - row.remainingBalance;
          const pct = Math.min(100, Math.max(0, Math.round((paid / (row.principalAmount || 1)) * 100)));

          return (
            <div className="text-right">
              <span className="font-heading font-bold text-sm tabular-nums text-ink block">
                {formatIDR(row.remainingBalance)}
              </span>
              <span className="text-[10px] text-muted font-body">Terbayar {pct}%</span>
            </div>
          );
        },
      },
      {
        id: 'progress',
        header: 'Progres Pelunasan',
        cell: (info) => {
          const row = info.row.original;
          const paid = row.principalAmount - row.remainingBalance;
          const pct = Math.min(100, Math.max(0, Math.round((paid / (row.principalAmount || 1)) * 100)));

          return (
            <div className="w-36 space-y-1">
              <div className="h-2.5 w-full bg-bg border border-ink/30 rounded-badge overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    row.type === 'payable' ? 'bg-primary' : 'bg-secondary'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted font-body">
                <span>{pct}%</span>
                <span>{row.remainingBalance === 0 ? 'Lunas' : 'Belum'}</span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'dueDate',
        header: 'Jatuh Tempo',
        cell: (info) => {
          const val = info.getValue() as string | null | undefined;
          if (!val) return <span className="text-xs text-muted">-</span>;
          return (
            <span className="text-xs font-semibold text-muted tabular-nums">
              {new Date(val).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const s = info.getValue() as DebtStatus;
          if (s === 'settled') {
            return <Badge variant="aman">Lunas ✓</Badge>;
          }
          if (s === 'overdue') {
            return <Badge variant="overdue">Terlambat ⚠</Badge>;
          }
          if (s === 'partially_paid') {
            return <Badge variant="menipis">Sebagian</Badge>;
          }
          return <Badge variant="secondary">Belum Bayar</Badge>;
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-center">Aksi</div>,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-center gap-1.5">
              {row.remainingBalance > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setPaymentTarget(row)}
                >
                  Bayar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setHistoryTarget(row)}
                title="Riwayat Cicilan"
              >
                <History className="w-4 h-4 text-muted" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredDebts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Hutang & Piutang Keluarga
          </h1>
          <p className="text-xs sm:text-sm text-muted font-body mt-1">
            Kelola pinjaman hutang dan hak tagih piutang beserta riwayat cicilan pelunasannya.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setCreateModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          {activeTab === 'payable' ? '+ Catat Hutang Baru' : '+ Catat Piutang Baru'}
        </Button>
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

      {/* Dual Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 p-1 bg-surface border-neo border-ink rounded-btn shadow-neo-sm w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('payable')}
            className={`px-4 py-2 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'payable'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Hutang (Kewajiban Bayar)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receivable')}
            className={`px-4 py-2 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer ${
              activeTab === 'receivable'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Piutang (Hak Tagih)
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Cari nama pihak / keterangan...`}
            className="w-full bg-surface text-ink border-neo border-ink rounded-btn h-10 pl-9 pr-3 text-xs font-body focus:outline-none focus:ring-2 focus:ring-secondary shadow-neo-sm"
          />
        </div>
      </div>

      {/* Summary Stat Cards for Active Tab */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider font-body block">
            {activeTab === 'payable' ? 'Total Sisa Hutang' : 'Total Sisa Piutang'}
          </span>
          <span className="font-heading font-bold text-2xl sm:text-3xl text-ink tabular-nums mt-1 block">
            {formatIDR(totalRemaining)}
          </span>
          <span className="text-[11px] text-muted font-body mt-1 block">
            Dari total pokok {formatIDR(totalPrincipal)}
          </span>
        </div>

        <div className="p-4 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider font-body block">
            {activeTab === 'payable' ? 'Hutang Aktif' : 'Piutang Aktif'}
          </span>
          <span className="font-heading font-bold text-2xl sm:text-3xl text-ink tabular-nums mt-1 block">
            {openCount} Catatan
          </span>
          <span className="text-[11px] text-muted font-body mt-1 block">
            Belum lunas sepenuhnya
          </span>
        </div>

        <div className="p-4 bg-[#FEE2E2] border-neo border-ink rounded-card shadow-neo-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-danger uppercase tracking-wider font-body block">
              Lewat Jatuh Tempo
            </span>
            <Badge variant="overdue" className="text-[10px]">
              Perlu Perhatian ⚠
            </Badge>
          </div>
          <span className="font-heading font-bold text-2xl sm:text-3xl text-danger tabular-nums mt-1 block">
            {overdueCount} Tagihan
          </span>
          <span className="text-[11px] text-danger/80 font-body mt-1 block">
            Telah melewati batas tanggal pelunasan
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
                <td colSpan={7} className="py-8 text-center text-muted font-body text-xs">
                  Memuat data...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted font-body text-xs">
                  Belum ada catatan {activeTab === 'payable' ? 'hutang' : 'piutang'} yang ditemukan.
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

      {/* MOBILE STACKED CARD LIST (< 768px) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-6 text-center text-muted text-xs">Memuat data...</div>
        ) : filteredDebts.length === 0 ? (
          <div className="p-6 text-center bg-surface border-neo border-ink rounded-card shadow-neo text-muted text-xs">
            Belum ada catatan {activeTab === 'payable' ? 'hutang' : 'piutang'} ditemukan.
          </div>
        ) : (
          filteredDebts.map((item) => {
            const paid = item.principalAmount - item.remainingBalance;
            const pct = Math.min(100, Math.max(0, Math.round((paid / (item.principalAmount || 1)) * 100)));

            return (
              <div
                key={item.id}
                className="bg-surface border-neo border-ink rounded-card shadow-neo p-4 flex flex-col gap-3"
              >
                {/* Header: Party Name + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-heading font-bold text-base text-ink leading-tight">
                      {item.partyName}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-muted font-body mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      item.status === 'settled'
                        ? 'aman'
                        : item.status === 'overdue'
                          ? 'overdue'
                          : item.status === 'partially_paid'
                            ? 'menipis'
                            : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {debtStatusLabels[item.status]}
                  </Badge>
                </div>

                {/* Progress Bar & Nominal */}
                <div className="p-3 bg-bg border border-ink/20 rounded-btn space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] text-muted block">Sisa Saldo</span>
                      <span className="font-heading font-bold text-lg tabular-nums text-ink">
                        {formatIDR(item.remainingBalance)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-muted block">Total Pokok</span>
                      <span className="font-heading font-semibold text-xs tabular-nums text-muted">
                        {formatIDR(item.principalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-2 w-full bg-surface border border-ink/30 rounded-badge overflow-hidden">
                      <div
                        className={`h-full ${item.type === 'payable' ? 'bg-primary' : 'bg-secondary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted font-body">
                      <span>Terbayar: {formatIDR(paid)}</span>
                      <span>{pct}%</span>
                    </div>
                  </div>

                  {item.dueDate && (
                    <div className="pt-1 text-[11px] text-muted font-body flex items-center gap-1 border-t border-ink/10">
                      <Clock className="w-3.5 h-3.5 text-muted" />
                      <span>
                        Jatuh tempo:{' '}
                        {new Date(item.dueDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {item.remainingBalance > 0 && (
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1 text-xs"
                      onClick={() => setPaymentTarget(item)}
                    >
                      Catat Pembayaran
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="md"
                    className="text-xs px-3"
                    onClick={() => setHistoryTarget(item)}
                    title="Riwayat Cicilan"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Catat Hutang / Piutang Baru */}
      <CreateDebtModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        defaultType={activeTab}
        onSuccess={() => {
          setCreateModalOpen(false);
          setNotification({
            type: 'success',
            message: `Catatan ${activeTab === 'payable' ? 'hutang' : 'piutang'} berhasil dibuat!`,
          });
          fetchDebts();
        }}
      />

      {/* MODAL 2: Catat Pembayaran / Cicilan */}
      {paymentTarget && (
        <RecordPaymentModal
          debt={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => {
            setPaymentTarget(null);
            setNotification({ type: 'success', message: 'Pembayaran berhasil dicatat!' });
            fetchDebts();
          }}
        />
      )}

      {/* MODAL 3: Riwayat Pembayaran / Cicilan */}
      {historyTarget && (
        <PaymentHistoryModal debt={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  );
}

// Subcomponent: Modal Catat Hutang / Piutang Baru
function CreateDebtModal({
  open,
  onOpenChange,
  defaultType,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType: DebtType;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateDebtReceivableInput>({
    resolver: zodResolver(createDebtReceivableSchema),
    defaultValues: {
      type: defaultType,
      partyName: '',
      description: '',
      principalAmount: 0,
      dueDate: '',
      notes: '',
    },
  });

  const selectedType = watch('type');

  useEffect(() => {
    if (open) {
      reset({
        type: defaultType,
        partyName: '',
        description: '',
        principalAmount: 0,
        dueDate: '',
        notes: '',
      });
      setError(null);
    }
  }, [open, defaultType, reset]);

  const onSubmit = async (data: CreateDebtReceivableInput) => {
    setError(null);
    try {
      const payload = {
        ...data,
        dueDate: data.dueDate ? data.dueDate : undefined,
      };
      await apiFetch('/debts-receivables', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan catatan');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={selectedType === 'payable' ? 'Catat Hutang Baru' : 'Catat Piutang Baru'}
      maxWidth="md"
    >
      {error && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-danger text-danger text-xs font-semibold rounded-btn">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-bg border border-ink/20 rounded-btn">
          <button
            type="button"
            onClick={() => setValue('type', 'payable')}
            className={`py-2 text-xs font-heading font-bold rounded-btn transition-all cursor-pointer ${
              selectedType === 'payable'
                ? 'bg-primary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Hutang (Kewajiban)
          </button>
          <button
            type="button"
            onClick={() => setValue('type', 'receivable')}
            className={`py-2 text-xs font-heading font-bold rounded-btn transition-all cursor-pointer ${
              selectedType === 'receivable'
                ? 'bg-secondary text-ink border border-ink shadow-neo-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Piutang (Hak Tagih)
          </button>
        </div>

        <Input
          label="Pihak Terkait (Orang / Bank / Toko)"
          placeholder="Contoh: Budi Santoso, Bank Mandiri"
          required
          error={errors.partyName?.message}
          {...register('partyName')}
        />

        <Controller
          name="principalAmount"
          control={control}
          render={({ field }) => (
            <IDRInput
              label="Nominal Pokok"
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.principalAmount?.message}
            />
          )}
        />

        <Input
          label="Tanggal Jatuh Tempo (Opsional)"
          type="date"
          error={errors.dueDate?.message}
          {...register('dueDate')}
        />

        <Input
          label="Deskripsi / Keperluan"
          placeholder="Contoh: Pinjaman renovasi rumah, talangan belanja"
          error={errors.description?.message}
          {...register('description')}
        />

        <Input
          label="Catatan Tambahan (Opsional)"
          placeholder="Keterangan lainnya..."
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
            Simpan Catatan
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Subcomponent: Modal Catat Pembayaran / Cicilan (with real-time balance pre-check)
function RecordPaymentModal({
  debt,
  onClose,
  onSuccess,
}: {
  debt: DebtItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      amount: Math.min(debt.remainingBalance, 100000),
      paymentMethod: 'transfer',
      notes: '',
    },
  });

  const enteredAmount = watch('amount') || 0;
  const isOverpayment = enteredAmount > debt.remainingBalance;
  const resultingBalance = Math.max(0, debt.remainingBalance - enteredAmount);

  const onSubmit = async (data: RecordPaymentInput) => {
    if (isOverpayment) {
      setError(`Nominal pembayaran tidak boleh melebihi sisa saldo (${formatIDR(debt.remainingBalance)})`);
      return;
    }

    setError(null);
    try {
      await apiFetch(`/debts-receivables/${debt.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal mencatat pembayaran');
    }
  };

  return (
    <Dialog open onOpenChange={onClose} title="Catat Pembayaran / Cicilan" maxWidth="md">
      {error && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-danger text-danger text-xs font-semibold rounded-btn">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Info Banner */}
        <div className="p-3 bg-bg border border-ink/20 rounded-btn space-y-1 text-xs font-body">
          <div className="flex justify-between">
            <span className="text-muted">Pihak Terkait:</span>
            <span className="font-bold text-ink">{debt.partyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Jenis Transaksi:</span>
            <span className="font-bold text-ink uppercase">
              {debt.type === 'payable' ? 'Hutang' : 'Piutang'}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-ink/10">
            <span className="text-muted">Sisa Saldo Saat Ini:</span>
            <span className="font-heading font-bold text-base text-ink tabular-nums">
              {formatIDR(debt.remainingBalance)}
            </span>
          </div>
        </div>

        <Input
          label="Tanggal Pembayaran"
          type="date"
          required
          error={errors.paymentDate?.message}
          {...register('paymentDate')}
        />

        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <IDRInput
              label="Nominal Pembayaran"
              value={field.value}
              onChange={field.onChange}
              required
              max={debt.remainingBalance}
              error={errors.amount?.message}
            />
          )}
        />

        {/* Real-time Overpayment Error Box */}
        {isOverpayment && (
          <div className="p-3 bg-[#FEE2E2] border-2 border-danger text-danger text-xs font-bold rounded-btn flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Nominal pembayaran ({formatIDR(enteredAmount)}) tidak boleh melebihi sisa saldo (
              {formatIDR(debt.remainingBalance)}).
            </span>
          </div>
        )}

        {/* Live Remaining Balance Preview */}
        {!isOverpayment && enteredAmount > 0 && (
          <div className="p-3 bg-surface border-2 border-ink rounded-btn shadow-neo-sm flex items-center justify-between text-xs font-body">
            <div>
              <span className="text-muted block text-[11px]">Sisa Saldo Setelah Bayar:</span>
              <span className="font-heading font-bold text-base text-ink tabular-nums">
                {formatIDR(resultingBalance)}
              </span>
            </div>
            {resultingBalance === 0 && (
              <Badge variant="aman" className="text-[10px]">
                Status Akan Menjadi: Lunas ✓
              </Badge>
            )}
          </div>
        )}

        <Select
          label="Metode Pembayaran"
          required
          error={errors.paymentMethod?.message}
          {...register('paymentMethod')}
        >
          <option value="transfer">Transfer Bank</option>
          <option value="cash">Tunai (Cash)</option>
          <option value="ewallet">E-Wallet</option>
          <option value="other">Lainnya</option>
        </Select>

        <Input
          label="Catatan Pembayaran (Opsional)"
          placeholder="Contoh: Cicilan ke-2 transfer via BCA"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
          <Button variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isOverpayment}
          >
            Simpan Pembayaran
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Subcomponent: Modal Riwayat Cicilan
function PaymentHistoryModal({ debt, onClose }: { debt: DebtItem; onClose: () => void }) {
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await apiFetch<any>(`/debts-receivables/${debt.id}/payments`);
        const list = Array.isArray(res) ? res : res.data || [];
        setPayments(list);
      } catch {
        setPayments([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [debt]);

  return (
    <Dialog open onOpenChange={onClose} title={`Riwayat Cicilan: ${debt.partyName}`} maxWidth="md">
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-xs text-muted text-center py-6">Memuat riwayat pembayaran...</p>
        ) : payments.length === 0 ? (
          <div className="p-6 text-center bg-bg border border-ink/20 rounded-btn text-xs text-muted font-body">
            Belum ada catatan pembayaran yang tercatat untuk transaksi ini.
          </div>
        ) : (
          <div className="divide-y divide-ink/15 border-2 border-ink rounded-btn overflow-hidden bg-surface max-h-72 overflow-y-auto">
            {payments.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between text-xs font-body">
                <div>
                  <span className="font-heading font-bold text-sm text-success tabular-nums block">
                    {formatIDR(p.amount)}
                  </span>
                  <span className="text-[11px] text-muted">
                    {new Date(p.paymentDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    • Metode: <strong className="uppercase">{p.paymentMethod}</strong>
                  </span>
                  {p.notes && <p className="text-xs text-ink font-body mt-0.5">{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="md" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
