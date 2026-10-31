'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  Users,
  Tags,
  Bell,
  Shield,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Mail,
  Phone,
  Save,
  LogOut,
  Building,
} from 'lucide-react';
import { Button, Input, Badge, Card, CardHeader, CardTitle, CardContent } from '@rumahkita/ui';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { IDRInput } from '@/components/ui/idr-input';
import {
  UpdateNotificationPreferenceInput,
  formatIDR,
} from '@rumahkita/contracts';
import { apiFetch } from '@/lib/api-fetcher';
import { useHousehold } from '@/contexts/household-context';
import { useAuth } from '@/contexts/auth-context';

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
}

interface HouseholdDetail {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  members: Member[];
}

interface MasterItem {
  id: string;
  name: string;
  description?: string | null;
  budgetLimit?: number | null;
  color?: string | null;
}

export default function PengaturanPage() {
  const { user, logout } = useAuth();
  const { activeHousehold, refreshHouseholds, isOwner } = useHousehold();
  const [activeTab, setActiveTab] = useState<'household' | 'categories' | 'notifications' | 'security'>(
    'household'
  );

  const [householdDetail, setHouseholdDetail] = useState<HouseholdDetail | null>(null);
  const [householdName, setHouseholdName] = useState('');
  const [isUpdatingHousehold, setIsUpdatingHousehold] = useState(false);

  // Master Categories State
  const [incomeSources, setIncomeSources] = useState<MasterItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<MasterItem[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<MasterItem[]>([]);

  // Notifications State
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
  const [createCategoryType, setCreateCategoryType] = useState<'source' | 'expense' | 'income'>('expense');
  const [catName, setCatName] = useState('');
  const [catBudgetLimit, setCatBudgetLimit] = useState<number>(0);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      const [hRes, sourcesRes, expCatsRes, incCatsRes, notifRes] = await Promise.all([
        apiFetch<any>('/household').catch(() => null),
        apiFetch<any>('/income-sources').catch(() => []),
        apiFetch<any>('/expense-categories').catch(() => []),
        apiFetch<any>('/income-categories').catch(() => []),
        apiFetch<any>('/settings/notifications').catch(() => null),
      ]);

      if (hRes) {
        setHouseholdDetail(hRes);
        setHouseholdName(hRes.name || '');
      }

      setIncomeSources(Array.isArray(sourcesRes) ? sourcesRes : sourcesRes.data || []);
      setExpenseCategories(Array.isArray(expCatsRes) ? expCatsRes : expCatsRes.data || []);
      setIncomeCategories(Array.isArray(incCatsRes) ? incCatsRes : incCatsRes.data || []);

      if (notifRes) {
        setEmailEnabled(Boolean(notifRes.emailEnabled));
        setEmailAddress(notifRes.emailAddress || user?.email || '');
        setWhatsappEnabled(Boolean(notifRes.whatsappEnabled));
        setWhatsappNumber(notifRes.whatsappNumber || '');
      }
    } catch {
      // Handled silently
    }
  }, [user]);

  useEffect(() => {
    if (activeHousehold) {
      loadAllData();
    }
  }, [activeHousehold, loadAllData]);

  // Update Household Name
  const handleUpdateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdName.trim()) return;

    setIsUpdatingHousehold(true);
    try {
      await apiFetch('/household', {
        method: 'PUT',
        body: JSON.stringify({ name: householdName.trim() }),
      });
      setNotification({ type: 'success', message: 'Nama rumah tangga berhasil diperbarui!' });
      refreshHouseholds();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal memperbarui rumah tangga' });
    } finally {
      setIsUpdatingHousehold(false);
    }
  };

  // Invite Member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await apiFetch(`/households/${activeHousehold?.id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'member' }),
      });
      setNotification({ type: 'success', message: `Undangan berhasil dikirim ke ${inviteEmail}` });
      setInviteEmail('');
      setInviteModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal mengirim undangan' });
    } finally {
      setIsInviting(false);
    }
  };

  // Save Notifications
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingNotifications(true);
    try {
      const payload: UpdateNotificationPreferenceInput = {
        emailEnabled,
        emailAddress: emailEnabled ? emailAddress.trim() : null,
        whatsappEnabled,
        whatsappNumber: whatsappEnabled ? whatsappNumber.trim() : null,
      };

      await apiFetch('/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setNotification({ type: 'success', message: 'Preferensi notifikasi berhasil disimpan!' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal menyimpan preferensi notifikasi' });
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsCreatingCategory(true);
    try {
      if (createCategoryType === 'source') {
        await apiFetch('/income-sources', {
          method: 'POST',
          body: JSON.stringify({ name: catName.trim() }),
        });
      } else if (createCategoryType === 'expense') {
        await apiFetch('/expense-categories', {
          method: 'POST',
          body: JSON.stringify({
            name: catName.trim(),
            budgetLimit: catBudgetLimit > 0 ? catBudgetLimit : undefined,
          }),
        });
      } else {
        await apiFetch('/income-categories', {
          method: 'POST',
          body: JSON.stringify({ name: catName.trim() }),
        });
      }

      setNotification({ type: 'success', message: 'Kategori baru berhasil ditambahkan!' });
      setCatName('');
      setCatBudgetLimit(0);
      setCreateCategoryModalOpen(false);
      loadAllData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal menambahkan kategori' });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-ink tracking-tight">
          Pengaturan Rumah Tangga
        </h1>
        <p className="text-xs sm:text-sm text-muted font-body mt-1">
          Kelola profil rumah tangga, anggota keluarga, kanal notifikasi, dan kategori anggaran.
        </p>
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

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-surface border-neo border-ink rounded-btn shadow-neo-sm">
        <button
          type="button"
          onClick={() => setActiveTab('household')}
          className={`px-3.5 py-2 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'household'
              ? 'bg-primary text-ink border border-ink shadow-neo-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Profil & Anggota</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`px-3.5 py-2 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'categories'
              ? 'bg-primary text-ink border border-ink shadow-neo-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Tags className="w-3.5 h-3.5" />
          <span>Kategori Anggaran</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-2 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'notifications'
              ? 'bg-primary text-ink border border-ink shadow-neo-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Kanal Notifikasi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-3.5 py-2 rounded-btn text-xs font-heading font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'security'
              ? 'bg-primary text-ink border border-ink shadow-neo-sm'
              : 'text-muted hover:text-ink'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Keamanan Sesi</span>
        </button>
      </div>

      {/* SECTION 1: PROFIL & ANGGOTA */}
      {activeTab === 'household' && (
        <div className="space-y-6">
          {/* Household Details Form */}
          <Card>
            <CardHeader>
              <CardTitle>Profil Rumah Tangga</CardTitle>
              <p className="text-xs text-muted font-body mt-0.5">
                Identitas rumah tangga yang dibagikan antar anggota keluarga.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateHousehold} className="space-y-4 max-w-lg">
                <Input
                  label="Nama Rumah Tangga"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  disabled={!isOwner}
                  required
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1 font-body">
                      Mata Uang Acuan
                    </label>
                    <div className="p-2.5 bg-bg border border-ink/20 rounded-btn text-xs font-bold font-body text-ink">
                      IDR (Rupiah)
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1 font-body">
                      Zona Waktu
                    </label>
                    <div className="p-2.5 bg-bg border border-ink/20 rounded-btn text-xs font-bold font-body text-ink">
                      Asia/Jakarta (WIB)
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isUpdatingHousehold}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Simpan Nama Rumah
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Members List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Anggota Keluarga</CardTitle>
                <p className="text-xs text-muted font-body mt-0.5">
                  Daftar pengguna yang memiliki akses bersama ke data keuangan rumah ini.
                </p>
              </div>

              {isOwner && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  + Undang Anggota
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-ink/15 border-2 border-ink rounded-btn overflow-hidden bg-surface">
                {(householdDetail?.members || []).map((m) => (
                  <div key={m.id} className="p-4 flex items-center justify-between text-xs font-body">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary border border-ink flex items-center justify-center font-heading font-bold text-sm text-ink shrink-0">
                        {m.user?.fullName ? m.user.fullName[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-ink block">
                            {m.user?.fullName || 'Pengguna'}
                          </span>
                          <Badge variant={m.role === 'owner' ? 'primary' : 'secondary'} className="text-[10px] py-0">
                            {m.role === 'owner' ? 'Pemilik' : 'Anggota'}
                          </Badge>
                        </div>
                        <span className="text-muted font-body block">{m.user?.email}</span>
                      </div>
                    </div>

                    <span className="text-[11px] text-muted hidden sm:inline">
                      Bergabung: {new Date(m.joinedAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 2: KATEGORI & MASTER DATA */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {/* Expense Categories */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Kategori Pengeluaran</CardTitle>
                <p className="text-xs text-muted font-body mt-0.5">
                  Pos pengeluaran belanja dapur, utilitas rumah tangga, dan operasional.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreateCategoryType('expense');
                  setCreateCategoryModalOpen(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                + Kategori
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {expenseCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 bg-surface border border-ink rounded-btn shadow-neo-sm flex items-center justify-between text-xs font-body"
                  >
                    <div>
                      <span className="font-heading font-bold text-sm text-ink block">{cat.name}</span>
                      {cat.budgetLimit && (
                        <span className="text-[11px] text-muted">
                          Batas: {formatIDR(cat.budgetLimit)}/bln
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Income Sources */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">Sumber Pendapatan</CardTitle>
                <p className="text-xs text-muted font-body mt-0.5">
                  Asal pemasukan kas keluarga (gaji kantor, usaha sampingan, dsb).
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCreateCategoryType('source');
                  setCreateCategoryModalOpen(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                + Sumber
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {incomeSources.map((src) => (
                  <div
                    key={src.id}
                    className="p-3 bg-surface border border-ink rounded-btn shadow-neo-sm flex items-center justify-between text-xs font-body"
                  >
                    <span className="font-heading font-bold text-sm text-ink">{src.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3: KANAL NOTIFIKASI STOK */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Preferensi Kanal Notifikasi Stok</CardTitle>
            <p className="text-xs text-muted font-body mt-0.5">
              Atur kanal pengiriman notifikasi otomatis jika stok barang belanjaan mencapai batas Menipis atau Habis.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveNotifications} className="space-y-6 max-w-xl">
              {/* Email Channel */}
              <div className="p-4 bg-surface border-2 border-ink rounded-card shadow-neo-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-btn bg-[#B9D9FF] border border-ink">
                      <Mail className="w-4 h-4 text-ink" />
                    </div>
                    <div>
                      <span className="font-heading font-bold text-sm text-ink block">
                        Notifikasi Email
                      </span>
                      <span className="text-xs text-muted font-body">
                        Kirim surel saat barang inventori mendekati ambang batas habis.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="w-5 h-5 accent-ink rounded cursor-pointer"
                  />
                </div>

                {emailEnabled && (
                  <Input
                    label="Alamat Email Penerima"
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    required={emailEnabled}
                  />
                )}
              </div>

              {/* WhatsApp Channel */}
              <div className="p-4 bg-surface border-2 border-ink rounded-card shadow-neo-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-btn bg-[#C8F169] border border-ink">
                      <Phone className="w-4 h-4 text-ink" />
                    </div>
                    <div>
                      <span className="font-heading font-bold text-sm text-ink block">
                        Notifikasi WhatsApp
                      </span>
                      <span className="text-xs text-muted font-body">
                        Kirim pesan instan WhatsApp resmi via Cloud API.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="w-5 h-5 accent-ink rounded cursor-pointer"
                  />
                </div>

                {whatsappEnabled && (
                  <div className="space-y-2">
                    <Input
                      label="Nomor WhatsApp (Awali +62)"
                      placeholder="+628123456789"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      required={whatsappEnabled}
                      helperText="Gunakan format internasional dengan kode negara +62"
                    />

                    <div className="p-3 bg-[#FEF3C7] border border-warning rounded-btn text-[11px] text-[#92400E] font-body leading-relaxed">
                      Pesan WhatsApp dikirimkan via integrasi resmi Meta WhatsApp Business Cloud API. Layanan ini
                      tidak menggunakan bot browser tidak resmi demi menjaga privasi dan keamanan akun Anda.
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isUpdatingNotifications}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Simpan Preferensi Notifikasi
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: KEAMANAN & SESI */}
      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Keamanan Sesi & Akun</CardTitle>
            <p className="text-xs text-muted font-body mt-0.5">
              Kelola sesi login aktif pada peramban web ini.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <div className="p-4 bg-bg border border-ink/20 rounded-btn text-xs font-body space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Nama Pengguna:</span>
                <span className="font-bold text-ink">{user?.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Email Login:</span>
                <span className="font-bold text-ink">{user?.email}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => logout()}
                className="text-danger hover:bg-[#FEE2E2]"
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Keluar dari Perangkat Ini
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: Undang Anggota Baru */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen} title="Undang Anggota Rumah Tangga" maxWidth="md">
        <form onSubmit={handleInviteMember} className="space-y-4">
          <p className="text-xs text-muted font-body">
            Kirimkan undangan ke anggota keluarga Anda (misalnya pasangan). Anggota yang diundang akan
            memiliki akses untuk mencatat transaksi dan melihat inventori bersama.
          </p>

          <Input
            label="Alamat Email Anggota"
            type="email"
            placeholder="pasangan@email.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setInviteModalOpen(false)}
              disabled={isInviting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isInviting}>
              Kirim Undangan
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: Tambah Kategori / Sumber Master */}
      <Dialog
        open={createCategoryModalOpen}
        onOpenChange={setCreateCategoryModalOpen}
        title={`Tambah ${
          createCategoryType === 'source'
            ? 'Sumber Pendapatan'
            : createCategoryType === 'expense'
              ? 'Kategori Pengeluaran'
              : 'Kategori Pemasukan'
        }`}
        maxWidth="md"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label="Nama Kategori / Sumber"
            placeholder="Contoh: Belanja Pasar, Transportasi, Gaji Pokok"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />

          {createCategoryType === 'expense' && (
            <IDRInput
              label="Batas Anggaran Bulanan (Opsional)"
              value={catBudgetLimit}
              onChange={setCatBudgetLimit}
              helperText="Digunakan sebagai pembanding batas pagu anggaran di laporan bulanan"
            />
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink/15">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setCreateCategoryModalOpen(false)}
              disabled={isCreatingCategory}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isCreatingCategory}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
