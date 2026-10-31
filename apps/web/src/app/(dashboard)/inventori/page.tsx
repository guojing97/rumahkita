'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  ArrowUpDown,
  Search,
  Check,
  AlertTriangle,
  History,
  Edit2,
  Trash2,
  Sliders,
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createItemSchema,
  CreateItemInput,
  stockAdjustmentSchema,
  StockAdjustmentInput,
  StockStatus,
  calculateStockStatus,
} from '@rumahkita/contracts';
import { Button, Input, Badge, Card, CardHeader, CardTitle, CardContent } from '@rumahkita/ui';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetcher';
import { useHousehold } from '@/contexts/household-context';

interface Item {
  id: string;
  name: string;
  category?: string | null;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  location?: string | null;
  notes?: string | null;
  status: StockStatus;
  isActive: boolean;
}

interface StockMovement {
  id: string;
  quantityDelta: number;
  resultingQuantity: number;
  reason: string;
  notes?: string | null;
  createdAt: string;
}

export default function InventoriPage() {
  const { activeHousehold } = useHousehold();
  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'SAFE' | 'LOW' | 'OUT'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  // Server-side pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [counts, setCounts] = useState<{ total: number; low: number; out: number }>({
    total: 0,
    low: 0,
    out: 0,
  });

  // Modals state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [allRes, lowRes, outRes] = await Promise.all([
        apiFetch<any>('/items?limit=1').catch(() => null),
        apiFetch<any>('/items?limit=1&status=LOW').catch(() => null),
        apiFetch<any>('/items?limit=1&status=OUT').catch(() => null),
      ]);
      setCounts({
        total: allRes?.meta?.total ?? 0,
        low: lowRes?.meta?.total ?? 0,
        out: outRes?.meta?.total ?? 0,
      });
    } catch {
      // ignore
    }
  }, []);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));
      if (statusFilter !== 'all') {
        queryParams.set('status', statusFilter);
      }
      if (categoryFilter !== 'all') {
        queryParams.set('category', categoryFilter);
      }
      if (searchQuery.trim()) {
        queryParams.set('search', searchQuery.trim());
      }

      const res = await apiFetch<any>(`/items?${queryParams.toString()}`);
      const list = Array.isArray(res) ? res : res.data || [];
      const meta = res?.meta;

      setItems(list);
      if (meta) {
        setTotalCount(meta.total ?? list.length);
        setTotalPages(meta.totalPages ?? (Math.ceil((meta.total ?? list.length) / limit) || 1));
      } else {
        setTotalCount(list.length);
        setTotalPages(Math.ceil(list.length / limit) || 1);
      }

      setCategories((prev) => {
        const set = new Set(prev);
        list.forEach((it: Item) => {
          if (it.category) set.add(it.category);
        });
        return Array.from(set);
      });
    } catch {
      setNotification({ type: 'error', message: 'Gagal memuat data inventori' });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    if (activeHousehold) {
      fetchItems();
    }
  }, [activeHousehold, fetchItems]);

  useEffect(() => {
    if (activeHousehold) {
      fetchCounts();
    }
  }, [activeHousehold, fetchCounts]);

  const from = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalCount);

  // TanStack Table Column Definitions
  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-ink"
          >
            <span>Nama Barang</span>
            <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          </button>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <span className="font-heading font-bold text-sm text-ink block">{row.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted font-body">Satuan: {row.unit}</span>
                {row.location && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-bg border border-ink/20 rounded-badge font-body text-ink">
                    📍 {row.location}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'category',
        header: 'Kategori',
        cell: (info) => (
          <span className="text-xs font-semibold text-muted font-body">
            {(info.getValue() as string) || '-'}
          </span>
        ),
      },
      {
        accessorKey: 'quantityOnHand',
        header: ({ column }) => (
          <div className="text-right">
            <button
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="inline-flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-ink"
            >
              <span>Stok Saat Ini</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
            </button>
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="text-right">
              <span className="font-heading font-bold text-base tabular-nums text-ink">
                {row.quantityOnHand}
              </span>
              <span className="text-xs text-muted font-normal ml-1">{row.unit}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'lowStockThreshold',
        header: () => <div className="text-right">Batas Min</div>,
        cell: (info) => (
          <div className="text-right text-xs text-muted font-body tabular-nums">
            {info.getValue() as number} {info.row.original.unit}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue() as string;
          if (status === 'SAFE' || status === 'Aman') {
            return <Badge variant="aman">Aman ✓</Badge>;
          }
          if (status === 'LOW' || status === 'Menipis') {
            return <Badge variant="menipis">Menipis ⚠</Badge>;
          }
          return <Badge variant="habis">Habis ✕</Badge>;
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-center">Aksi</div>,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex items-center justify-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setAdjustingItem(row)}
              >
                Sesuaikan
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  setEditingItem(row);
                  setItemModalOpen(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setHistoryItem(row)}
                title="Riwayat Pergerakan"
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
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/items/${deleteTarget.id}`, { method: 'DELETE' });
      setNotification({ type: 'success', message: `Barang "${deleteTarget.name}" berhasil dihapus` });
      setDeleteTarget(null);
      fetchItems();
      fetchCounts();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal menghapus barang' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
            Inventori & Stok Barang
          </h1>
          <p className="text-xs sm:text-sm text-muted font-body mt-1">
            Pantau stok barang dapur, bahan makanan, dan kebutuhan sehari-hari rumah tangga.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditingItem(null);
            setItemModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          + Tambah Barang
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

      {/* 3 Summary Status Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            setPage(1);
          }}
          className={`p-4 bg-surface border-neo border-ink rounded-card text-left transition-all cursor-pointer ${
            statusFilter === 'all' ? 'shadow-neo ring-3 ring-secondary' : 'shadow-neo-sm'
          }`}
        >
          <span className="text-xs font-semibold text-muted uppercase tracking-wider font-body block">
            Semua Barang
          </span>
          <span className="font-heading font-bold text-2xl sm:text-3xl text-ink tabular-nums mt-1 block">
            {counts.total || (statusFilter === 'all' ? totalCount : items.length)} Barang
          </span>
          <span className="text-[11px] text-muted font-body mt-1 block">
            Total barang terdaftar di inventori
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('LOW');
            setPage(1);
          }}
          className={`p-4 bg-[#FEF3C7] border-neo border-ink rounded-card text-left transition-all cursor-pointer ${
            statusFilter === 'LOW' ? 'shadow-neo ring-3 ring-warning' : 'shadow-neo-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#92400E] uppercase tracking-wider font-body block">
              Stok Menipis
            </span>
            <Badge variant="menipis" className="text-[10px]">
              Menipis ⚠
            </Badge>
          </div>
          <span className="font-heading font-bold text-2xl sm:text-3xl text-[#92400E] tabular-nums mt-1 block">
            {counts.low || (statusFilter === 'LOW' ? totalCount : 0)} Barang
          </span>
          <span className="text-[11px] text-[#92400E]/80 font-body mt-1 block">
            Di bawah atau sama dengan batas minimum
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('OUT');
            setPage(1);
          }}
          className={`p-4 bg-[#FEE2E2] border-neo border-ink rounded-card text-left transition-all cursor-pointer ${
            statusFilter === 'OUT' ? 'shadow-neo ring-3 ring-danger' : 'shadow-neo-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#991B1B] uppercase tracking-wider font-body block">
              Stok Habis
            </span>
            <Badge variant="habis" className="text-[10px]">
              Habis ✕
            </Badge>
          </div>
          <span className="font-heading font-bold text-2xl sm:text-3xl text-[#991B1B] tabular-nums mt-1 block">
            {counts.out || (statusFilter === 'OUT' ? totalCount : 0)} Barang
          </span>
          <span className="text-[11px] text-[#991B1B]/80 font-body mt-1 block">
            Segera belanja untuk mengisi kembali
          </span>
        </button>
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama barang, kategori, lokasi..."
            className="w-full bg-surface text-ink border-neo border-ink rounded-btn h-10 pl-9 pr-3 text-xs font-body focus:outline-none focus:ring-2 focus:ring-secondary shadow-neo-sm"
          />
        </div>

        {categories.length > 0 && (
          <div className="w-full sm:w-48">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-surface text-ink border-neo border-ink rounded-btn h-10 px-3 text-xs font-body focus:outline-none focus:ring-2 focus:ring-secondary shadow-neo-sm cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
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
                  Memuat data inventori...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted font-body text-xs">
                  Belum ada barang terdaftar dalam kategori ini.
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
          <div className="p-6 text-center text-muted text-xs">Memuat inventori...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center bg-surface border-neo border-ink rounded-card shadow-neo text-muted text-xs">
            Belum ada barang ditemukan.
          </div>
        ) : (
          items.map((item) => {
            const isSafe = item.status === 'SAFE' || (item.status as any) === 'Aman';
            const isLow = item.status === 'LOW' || (item.status as any) === 'Menipis';
            return (
              <div
                key={item.id}
                className="bg-surface border-neo border-ink rounded-card shadow-neo p-4 flex flex-col gap-3"
              >
                {/* Header: Name and Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-heading font-bold text-base text-ink leading-tight">
                      {item.name}
                    </h4>
                    {item.category && (
                      <span className="text-xs text-muted font-body">{item.category}</span>
                    )}
                  </div>
                  <Badge variant={isSafe ? 'aman' : isLow ? 'menipis' : 'habis'}>
                    {isSafe ? 'Aman ✓' : isLow ? 'Menipis ⚠' : 'Habis ✕'}
                  </Badge>
                </div>

                {/* Stock Quantity Highlight */}
                <div className="p-3 bg-bg border border-ink/20 rounded-btn flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted block">Stok Saat Ini</span>
                    <span className="font-heading font-bold text-xl tabular-nums text-ink">
                      {item.quantityOnHand}{' '}
                      <span className="text-sm font-normal text-muted">{item.unit}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted block">Batas Minimum</span>
                    <span className="font-heading font-medium text-sm tabular-nums text-muted">
                      {item.lowStockThreshold} {item.unit}
                    </span>
                  </div>
                </div>

                {/* Action Buttons with 44px min touch targets */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full text-xs"
                    onClick={() => setAdjustingItem(item)}
                  >
                    Sesuaikan Stok
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    className="w-full text-xs"
                    onClick={() => {
                      setEditingItem(item);
                      setItemModalOpen(true);
                    }}
                  >
                    Edit Barang
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PAGINATION BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-surface border-neo border-ink rounded-card shadow-neo-sm">
        <span className="text-xs font-semibold text-muted font-body">
          Menampilkan {from} - {to} dari {totalCount} barang
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

      {/* MODAL 1: Tambah / Edit Barang */}
      <ItemModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        item={editingItem}
        onSuccess={() => {
          setItemModalOpen(false);
          setNotification({
            type: 'success',
            message: editingItem ? 'Barang berhasil diperbarui!' : 'Barang berhasil ditambahkan!',
          });
          fetchItems();
          fetchCounts();
        }}
      />

      {/* MODAL 2: Sesuaikan Stok Manual */}
      {adjustingItem && (
        <StockAdjustmentModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSuccess={() => {
            setAdjustingItem(null);
            setNotification({ type: 'success', message: 'Stok barang berhasil disesuaikan!' });
            fetchItems();
            fetchCounts();
          }}
        />
      )}

      {/* MODAL 3: Riwayat Pergerakan Stok */}
      {historyItem && (
        <StockHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
    </div>
  );
}

// Subcomponent: Modal Tambah / Edit Barang
function ItemModal({
  open,
  onOpenChange,
  item,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: '',
      category: '',
      unit: '',
      quantityOnHand: 0,
      lowStockThreshold: 1,
      location: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (item) {
        reset({
          name: item.name,
          category: item.category || '',
          unit: item.unit,
          quantityOnHand: item.quantityOnHand,
          lowStockThreshold: item.lowStockThreshold,
          location: item.location || '',
          notes: item.notes || '',
        });
      } else {
        reset({
          name: '',
          category: '',
          unit: '',
          quantityOnHand: 0,
          lowStockThreshold: 1,
          location: '',
          notes: '',
        });
      }
      setError(null);
    }
  }, [open, item, reset]);

  const onSubmit = async (data: CreateItemInput) => {
    setError(null);
    try {
      if (item) {
        await apiFetch(`/items/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } else {
        await apiFetch('/items', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan barang');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Ubah Informasi Barang' : 'Tambah Barang ke Inventori'}
      maxWidth="lg"
    >
      {error && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-danger text-danger text-xs font-semibold rounded-btn">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Nama Barang"
          placeholder="Contoh: Beras Ramos 5kg, Minyak Goreng Sania 2L"
          required
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kategori"
            placeholder="Contoh: Dapur, Kebersihan"
            error={errors.category?.message}
            {...register('category')}
          />

          <Input
            label="Satuan"
            placeholder="kg, liter, pcs, pack"
            required
            error={errors.unit?.message}
            {...register('unit')}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Stok Saat Ini"
            type="number"
            min="0"
            required
            error={errors.quantityOnHand?.message}
            {...register('quantityOnHand')}
          />

          <Input
            label="Ambang Batas Minimum"
            type="number"
            min="0"
            required
            helperText="Peringatan aktif bila stok ≤ batas ini"
            error={errors.lowStockThreshold?.message}
            {...register('lowStockThreshold')}
          />
        </div>

        <Input
          label="Lokasi Penyimpanan (Opsional)"
          placeholder="Contoh: Lemari Dapur, Kulkas Bawah"
          error={errors.location?.message}
          {...register('location')}
        />

        <Input
          label="Catatan (Opsional)"
          placeholder="Keterangan tambahan..."
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
            {item ? 'Simpan Perubahan' : 'Tambah Barang'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Subcomponent: Sesuaikan Stok Manual Modal (with strict non-negative pre-check)
function StockAdjustmentModal({
  item,
  onClose,
  onSuccess,
}: {
  item: Item;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [direction, setDirection] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState('manual_correction');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delta = direction === 'add' ? amount : -amount;
  const resultingStock = item.quantityOnHand + delta;
  const isNegativeStock = resultingStock < 0;

  const resultingStatus = calculateStockStatus(resultingStock, item.lowStockThreshold);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNegativeStock) {
      setError('Stok akhir tidak boleh kurang dari 0!');
      return;
    }

    if (amount <= 0) {
      setError('Jumlah perubahan harus lebih dari 0');
      return;
    }

    const finalReason = reason === 'other' ? customReason.trim() : reason;
    if (!finalReason || finalReason.length < 3) {
      setError('Alasan penyesuaian stok wajib diisi minimal 3 karakter');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/items/${item.id}/stock-adjustments`, {
        method: 'POST',
        body: JSON.stringify({
          delta,
          reason: finalReason,
        }),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyesuaikan stok');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose} title={`Koreksi Stok: ${item.name}`} maxWidth="md">
      {error && (
        <div className="mb-4 p-3 bg-[#FEE2E2] border border-danger text-danger text-xs font-semibold rounded-btn">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Stock Banner */}
        <div className="p-3 bg-bg border border-ink/20 rounded-btn flex items-center justify-between text-xs font-body">
          <span className="text-muted">Stok Saat Ini:</span>
          <span className="font-heading font-bold text-base text-ink tabular-nums">
            {item.quantityOnHand} {item.unit}
          </span>
        </div>

        {/* Direction Toggle */}
        <div>
          <label className="block text-xs font-heading font-bold uppercase tracking-wider text-muted mb-1.5">
            Arah Perubahan Stok
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('add')}
              className={`py-2 px-3 rounded-btn border-2 text-xs font-bold font-heading transition-all cursor-pointer ${
                direction === 'add'
                  ? 'bg-primary text-ink border-ink shadow-neo-sm'
                  : 'bg-surface text-muted border-ink/30 hover:border-ink'
              }`}
            >
              (+) Tambah Stok
            </button>
            <button
              type="button"
              onClick={() => setDirection('subtract')}
              className={`py-2 px-3 rounded-btn border-2 text-xs font-bold font-heading transition-all cursor-pointer ${
                direction === 'subtract'
                  ? 'bg-[#FFE4E6] text-danger border-danger shadow-neo-sm'
                  : 'bg-surface text-muted border-ink/30 hover:border-ink'
              }`}
            >
              (-) Kurangi Stok
            </button>
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5 font-body">
            Jumlah Perubahan ({item.unit})
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full bg-surface text-ink border-neo border-ink rounded-input h-11 px-3.5 text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-secondary"
            required
          />
        </div>

        {/* Negative Stock Warning Box */}
        {isNegativeStock && (
          <div className="p-3 bg-[#FEE2E2] border-2 border-danger text-danger text-xs font-bold rounded-btn flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Penyesuaian tidak valid: Stok akhir tidak boleh kurang dari 0 (Maksimal pengurangan:{' '}
              {item.quantityOnHand} {item.unit}).
            </span>
          </div>
        )}

        {/* Live Preview Box */}
        {!isNegativeStock && (
          <div className="p-3 bg-surface border-2 border-ink rounded-btn shadow-neo-sm flex items-center justify-between text-xs font-body">
            <div>
              <span className="text-muted block text-[11px]">Pratinjau Stok Akhir:</span>
              <span className="font-heading font-bold text-base text-ink tabular-nums">
                {item.quantityOnHand} → <span className="text-success">{resultingStock}</span>{' '}
                {item.unit}
              </span>
            </div>
            <Badge
              variant={
                resultingStatus === 'SAFE'
                  ? 'aman'
                  : resultingStatus === 'LOW'
                    ? 'menipis'
                    : 'habis'
              }
            >
              {resultingStatus === 'SAFE'
                ? 'Aman ✓'
                : resultingStatus === 'LOW'
                  ? 'Menipis ⚠'
                  : 'Habis ✕'}
            </Badge>
          </div>
        )}

        {/* Reason Dropdown & Custom Note */}
        <Select
          label="Alasan Penyesuaian"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        >
          <option value="manual_correction">Koreksi Manual / Salah Hitung</option>
          <option value="waste">Rusak / Basi / Tumpah / Kadaluarsa</option>
          <option value="purchase">Pembelian di Luar Sistem</option>
          <option value="initial">Penyesuaian Stok Awal</option>
          <option value="other">Alasan Lainnya...</option>
        </Select>

        {reason === 'other' && (
          <Input
            label="Keterangan Alasan"
            placeholder="Tuliskan alasan penyesuaian stok..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            required
          />
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
          <Button variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isNegativeStock}
          >
            Simpan Penyesuaian
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Subcomponent: Riwayat Pergerakan Stok Modal
function StockHistoryModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await apiFetch<any>(`/items/${item.id}/stock-adjustments`);
        const list = Array.isArray(res) ? res : res.data || [];
        setMovements(list);
      } catch {
        setMovements([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [item]);

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={`Riwayat Pergerakan: ${item.name}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-xs text-muted text-center py-6">Memuat riwayat...</p>
        ) : movements.length === 0 ? (
          <div className="p-6 text-center bg-bg border border-ink/20 rounded-btn text-xs text-muted font-body">
            Belum ada catatan pergerakan stok untuk barang ini.
          </div>
        ) : (
          <div className="divide-y divide-ink/15 border-2 border-ink rounded-btn overflow-hidden bg-surface max-h-72 overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="p-3 flex items-center justify-between text-xs font-body">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-heading font-bold text-sm tabular-nums ${
                        m.quantityDelta > 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} {item.unit}
                    </span>
                    <span className="text-[10px] text-muted font-semibold uppercase">
                      • {m.reason}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted block mt-0.5">
                    {new Date(m.createdAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-muted block text-[11px]">Stok Akhir:</span>
                  <span className="font-heading font-bold text-sm text-ink tabular-nums">
                    {m.resultingQuantity} {item.unit}
                  </span>
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
