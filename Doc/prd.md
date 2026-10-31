# PRD --- Household Finance & Inventory MVP

**Status:** Draft v1.0\
**Product type:** Private household web application\
**Primary users:** Two household members (user and spouse)\
**Locale:** Indonesia (`id-ID`), timezone `Asia/Jakarta`, currency `IDR`

## 1. Ringkasan Produk

Aplikasi web privat untuk membantu pasangan mencatat keuangan rumah
tangga dan memantau stok barang kebutuhan. Aplikasi menyatukan transaksi
pemasukan, pengeluaran, pembelian kebutuhan, hutang, piutang, sumber
pendapatan, inventori, pengingat stok, serta laporan bulanan dan
tahunan.

Tujuan MVP adalah menyediakan **pencatatan yang konsisten dan laporan
yang dapat dipercaya**, bukan menggantikan aplikasi akuntansi penuh.
Semua data dimiliki satu ruang rumah tangga yang dapat diakses oleh dua
akun anggota.

## 2. Masalah yang Diselesaikan

-   Catatan keuangan tersebar di chat, buku, atau spreadsheet.
-   Sulit melihat total pemasukan, pengeluaran, dan sisa arus kas per
    periode.
-   Hutang dan piutang berisiko terlupa tanggal jatuh tempo atau status
    pelunasannya.
-   Barang kebutuhan rumah tangga habis tanpa diketahui lebih awal.
-   Pembelian barang tidak selalu terhubung dengan catatan stok dan
    pengeluaran.
-   Pasangan membutuhkan satu sumber data yang sama dan laporan
    sederhana.

## 3. Sasaran dan Ukuran Keberhasilan

### Sasaran MVP

1.  Pengguna dapat mencatat pemasukan dan pengeluaran dalam kurang dari
    30 detik per transaksi.
2.  Pengguna dapat mencatat pembelian kebutuhan dan memperbarui stok
    dengan konsisten.
3.  Pengguna dapat melihat ringkasan keuangan per bulan dan tahun.
4.  Pengguna dapat melihat hutang/piutang yang belum lunas dan jatuh
    tempo.
5.  Sistem memberi notifikasi stok rendah melalui email dan WhatsApp
    jika kanal telah dikonfigurasi.
6.  Dua anggota rumah tangga dapat menggunakan ruang data yang sama.

### Metrik awal

-   ≥90% transaksi rumah tangga yang diketahui tercatat di aplikasi.
-   100% transaksi memiliki tanggal, nominal, kategori, dan pencatat.
-   Tidak ada transaksi ganda akibat retry request.
-   Laporan periode sama dengan hasil agregasi transaksi yang tersimpan.
-   Notifikasi stok rendah tidak terkirim berulang pada setiap
    pemeriksaan; satu kejadian stok rendah hanya mengirim notifikasi
    sesuai kebijakan deduplikasi.

## 4. Pengguna dan Hak Akses

### Persona

-   **Pemilik rumah tangga:** membuat ruang rumah tangga, mengundang
    pasangan, mengelola pengaturan dan data.
-   **Anggota rumah tangga:** mencatat dan membaca transaksi, inventori,
    hutang/piutang, serta laporan.

### Aturan akses

-   MVP menggunakan satu `household` dengan dua anggota, namun model
    data mendukung lebih dari satu household secara teknis.
-   Setiap record bisnis wajib terkait `household_id`.
-   Setiap request memvalidasi keanggotaan household di backend;
    menyembunyikan menu di UI bukan kontrol keamanan.
-   Pemilik dapat mengundang/menghapus anggota dan mengatur preferensi
    notifikasi.
-   Anggota dapat membuat dan mengubah transaksi. Penghapusan transaksi
    dibatasi ke soft-delete atau pembatalan yang tercatat.
-   Catatan `created_by` dan `updated_by` disimpan untuk audit
    sederhana.

## 5. Ruang Lingkup

### Termasuk MVP

-   Login, logout, refresh session, reset password.
-   Household dan undangan anggota.
-   Dashboard ringkasan.
-   Master kategori pemasukan/pengeluaran.
-   Sumber pendapatan.
-   Pemasukan.
-   Pengeluaran.
-   Barang/inventori dan ambang stok minimum.
-   Pembelian yang dapat menambah stok dan mencatat pengeluaran.
-   Hutang dan piutang beserta pembayaran/cicilan.
-   Laporan bulanan dan tahunan.
-   Notifikasi stok rendah melalui email dan WhatsApp.
-   Pengaturan profil, mata uang, timezone, serta kanal notifikasi.
-   Ekspor CSV untuk transaksi dan laporan sederhana.

### Tidak termasuk MVP

-   Integrasi rekening bank/open banking atau sinkronisasi mutasi
    otomatis.
-   OCR struk, pemindaian barcode, dan prediksi belanja.
-   Budgeting kompleks, investasi, aset tetap, dan akuntansi
    double-entry penuh.
-   Multi-currency.
-   Aplikasi native iOS/Android.
-   Integrasi marketplace atau sinkronisasi harga.
-   Chatbot AI dan rekomendasi keuangan otomatis.

## 6. Modul dan Kebutuhan Fungsional

### 6.1 Autentikasi dan Household

-   Login dengan email dan password.
-   Logout dari perangkat saat ini; opsi mencabut semua sesi.
-   Access token berlaku 15 menit.
-   Refresh token berlaku maksimal 7 hari, disimpan dalam cookie
    `HttpOnly`, `Secure`, `SameSite`.
-   Refresh token dirotasi setiap kali digunakan; token lama tidak dapat
    dipakai kembali.
-   Simpan hash refresh token di database, bukan token mentah.
-   Reset password menggunakan token sekali pakai yang kedaluwarsa.
-   Pemilik membuat household dan mengundang pasangan lewat email.
-   Pengguna hanya dapat membaca/mengubah data household yang
    diikutinya.

### 6.2 Dashboard

Menampilkan: - Total pemasukan periode berjalan. - Total pengeluaran
periode berjalan. - Arus kas bersih: pemasukan dikurangi pengeluaran. -
Jumlah hutang belum lunas dan piutang belum diterima. - Daftar barang
stok rendah. - Transaksi terbaru. - Grafik pemasukan vs pengeluaran per
bulan. - Pemilih periode: bulan ini, bulan sebelumnya, tahun ini, dan
rentang kustom.

Nilai dashboard harus berasal dari data backend dan mengikuti filter
tanggal serta household yang aktif.

### 6.3 Barang / Inventori

Data barang: - Nama barang (wajib). - Kategori barang. - Satuan (pcs,
pack, kg, liter, botol, dan sebagainya). - Jumlah stok saat ini. -
Ambang stok minimum. - Lokasi penyimpanan opsional. - Catatan
opsional. - Status aktif/nonaktif.

Fungsi: - Tambah, lihat, ubah, dan arsipkan barang. - Cari berdasarkan
nama dan filter kategori/status stok. - Tampilkan status `Aman`,
`Menipis`, atau `Habis`. - Stok tidak boleh negatif secara default. -
Setiap perubahan stok harus membuat catatan pergerakan stok dengan
alasan, waktu, pengguna, dan referensi transaksi jika ada. - Koreksi
stok manual wajib mengisi alasan. - Stok rendah terjadi saat
`quantity_on_hand <= low_stock_threshold`. - Perubahan stok akibat
pembelian memperbarui stok dalam transaksi database yang sama dengan
pencatatan pembelian.

### 6.4 Pemasukan

Field: - Tanggal transaksi. - Nominal IDR (positif). - Sumber pendapatan
(wajib, dapat berupa gaji, usaha, bonus, hadiah, dan lainnya). -
Kategori pemasukan opsional. - Deskripsi/catatan. - Penerima/pencatat. -
Waktu dibuat dan diperbarui.

Fungsi: - CRUD dengan validasi nominal \> 0. - Filter tanggal, sumber,
kategori, dan pencatat. - Cari berdasarkan catatan. - Pemasukan yang
terkait pelunasan piutang tidak boleh dihitung ganda. Pembayaran piutang
dicatat sebagai pelunasan piutang, bukan pemasukan baru, kecuali
pengguna memilih skema pencatatan yang jelas.

### 6.5 Pengeluaran

Field: - Tanggal transaksi. - Nominal IDR (positif). - Kategori
pengeluaran (wajib). - Metode pembayaran opsional (tunai, transfer,
e-wallet, lainnya). - Deskripsi/catatan. - Pencatat. - Referensi
pembelian opsional.

Fungsi: - CRUD, pencarian, filter periode/kategori/metode. - Pengeluaran
dapat dibuat mandiri atau otomatis dari pembelian. - Pengeluaran yang
dibuat otomatis dari pembelian tidak boleh dibuat lagi sebagai transaksi
terpisah untuk pembelian yang sama. - Pengeluaran yang telah digunakan
dalam laporan tetap dapat dikoreksi melalui edit atau pembatalan yang
tercatat.

### 6.6 Sumber Pendapatan

-   CRUD sumber pendapatan, misalnya gaji, usaha, freelance, bonus, dan
    lainnya.
-   Nama wajib dan unik per household.
-   Sumber yang telah dipakai transaksi tidak dihapus permanen; dapat
    diarsipkan.
-   Laporan dapat dikelompokkan berdasarkan sumber.

### 6.7 Pembelian

Pembelian merepresentasikan pembelian barang kebutuhan dan dapat
menghubungkan pengeluaran serta inventori.

Field: - Tanggal pembelian. - Barang dan kuantitas per item. - Harga
satuan dan subtotal per item. - Total pembelian. - Toko/vendor
opsional. - Metode pembayaran opsional. - Kategori pengeluaran. -
Catatan dan pencatat. - Status: `Draft`, `Completed`, `Cancelled`.

Aturan: - Hanya pembelian `Completed` yang menambah stok dan membuat
pengeluaran. - Saat menyelesaikan pembelian, pembuatan pengeluaran, item
pembelian, pergerakan stok, dan pembaruan stok harus atomik dalam satu
transaksi database. - `Cancelled` tidak mengubah stok atau membuat
pengeluaran baru; pembatalan pembelian yang sudah selesai harus melalui
proses reversal yang tercatat, bukan menghapus data diam-diam. -
Kuantitas dan harga satuan tidak boleh negatif. - Total dihitung di
backend dari item, bukan dipercaya dari angka total yang dikirim UI. -
MVP dapat mengizinkan pembelian tanpa barang inventori, tetapi harus
tetap membuat pengeluaran; tandai jelas pada UI.

### 6.8 Hutang dan Piutang

Hutang: kewajiban household untuk dibayar. Piutang: uang yang berhak
diterima household.

Field bersama: - Jenis: `Payable` (hutang) atau `Receivable`
(piutang). - Nama pihak terkait. - Deskripsi. - Nominal awal. - Tanggal
dibuat dan tanggal jatuh tempo. - Status: `Open`, `PartiallyPaid`,
`Settled`, `Overdue`, `Cancelled`. - Catatan dan pencatat.

Fungsi: - Mencatat pembayaran/penerimaan sebagian atau penuh. -
Menampilkan saldo tersisa, riwayat pembayaran, dan jatuh tempo. -
Validasi jumlah pembayaran \> 0 dan tidak melebihi saldo tersisa. -
Status terlambat dihitung dari jatuh tempo dan saldo yang masih ada. -
Pembayaran hutang mengurangi saldo kas secara konseptual dan tidak
otomatis dihitung sebagai pengeluaran baru jika pengeluaran awal sudah
dicatat. Piutang yang diterima tidak otomatis dihitung sebagai pemasukan
baru jika pemasukan awal telah dicatat. - Untuk MVP, tetapkan kebijakan
pencatatan: hutang/piutang yang belum pernah masuk transaksi kas tidak
memengaruhi laporan arus kas sampai uang benar-benar keluar/masuk. UI
harus menjelaskan pilihan ini agar tidak terjadi penghitungan ganda.

### 6.9 Laporan Bulanan dan Tahunan

-   Laporan pemasukan, pengeluaran, dan arus kas bersih.
-   Tren pemasukan vs pengeluaran per bulan.
-   Rincian per kategori pengeluaran.
-   Rincian pemasukan per sumber pendapatan.
-   Ringkasan hutang/piutang: saldo awal, tambahan,
    pembayaran/penerimaan, saldo akhir.
-   Ringkasan stok rendah dan riwayat pembelian.
-   Filter tahun/bulan dan rentang tanggal.
-   Ekspor CSV dengan nama kolom yang jelas.
-   Definisi arus kas: total transaksi kas pemasukan dikurangi total
    transaksi kas pengeluaran pada periode terpilih; transfer antar akun
    (jika kelak ada) tidak termasuk pendapatan/pengeluaran.

### 6.10 Notifikasi Stok Rendah

-   Pengguna mengaktifkan email dan/atau WhatsApp pada pengaturan.
-   Ambang stok ditetapkan per barang.
-   Saat stok berubah dari aman menjadi rendah/habis, sistem membuat
    event notifikasi.
-   Notifikasi mencantumkan nama barang, stok saat ini, satuan, ambang
    minimum, dan saran untuk mengecek barang.
-   Deduplicasi: jangan mengirim notifikasi berulang untuk kondisi
    rendah yang sama. Kirim ulang hanya setelah stok kembali aman lalu
    turun lagi, atau sesuai kebijakan pengingat harian yang eksplisit.
-   Simpan status pengiriman, waktu, kanal, dan error agar kegagalan
    dapat dicoba ulang.
-   Email menggunakan provider SMTP/transaksional.
-   WhatsApp menggunakan WhatsApp Business Platform/Cloud API atau
    provider resmi. Memerlukan nomor bisnis, konfigurasi, persetujuan
    pengguna, dan template pesan yang sesuai kebijakan Meta jika
    diwajibkan. Jangan mengandalkan otomasi WhatsApp Web tidak resmi.
-   Jika kanal belum dikonfigurasi, UI menampilkan status belum aktif
    dan aplikasi tetap berfungsi.

## 7. Alur Pengguna Utama

### A. Mencatat pengeluaran biasa

1.  Pengguna membuka Pengeluaran → Tambah.
2.  Mengisi tanggal, nominal, kategori, dan catatan opsional.
3.  Backend memvalidasi household dan data.
4.  Transaksi tersimpan dan dashboard/laporan diperbarui.

### B. Menyelesaikan pembelian kebutuhan

1.  Pengguna memilih Pembelian → Buat pembelian.
2.  Memilih barang, jumlah, harga, kategori pengeluaran, dan metode
    pembayaran.
3.  UI menampilkan total yang dihitung ulang oleh backend.
4.  Pengguna menekan `Selesaikan pembelian`.
5.  Backend dalam satu transaksi membuat pembelian, pengeluaran,
    pergerakan stok, dan pembaruan stok.
6.  Sistem mengevaluasi apakah stok perlu diberi notifikasi.

### C. Mencatat hutang/piutang

1.  Pengguna memilih jenis, pihak, nominal, dan jatuh tempo.
2.  Sistem menampilkan saldo terbuka.
3.  Saat pembayaran/penerimaan terjadi, pengguna mencatat nominal dan
    tanggal.
4.  Sistem menghitung saldo dan status; laporan mencegah pencatatan kas
    ganda.

### D. Notifikasi barang menipis

1.  Stok diperbarui melalui pembelian atau koreksi.
2.  Backend mendeteksi transisi stok menjadi rendah/habis.
3.  Event disimpan ke antrean/outbox.
4.  Worker mengirim email dan/atau WhatsApp.
5.  Status sukses/gagal disimpan; kegagalan dapat dicoba ulang tanpa
    menggandakan notifikasi sukses.

## 8. Aturan Bisnis dan Data

-   Mata uang MVP hanya IDR; simpan nominal sebagai integer rupiah
    (`BIGINT`) atau `NUMERIC(14,0)`, jangan `float`.
-   Tanggal transaksi disimpan sebagai `DATE` bila hanya tanggal bisnis;
    timestamp audit disimpan sebagai `TIMESTAMPTZ`.
-   Gunakan UUID untuk ID publik.
-   Soft delete/arsip untuk master data yang sudah direferensikan.
-   Backend adalah sumber kebenaran untuk total, status, stok, saldo,
    dan hak akses.
-   Semua operasi multi-record yang saling terkait menggunakan transaksi
    PostgreSQL.
-   Gunakan idempotency key untuk aksi yang dapat diulang, khususnya
    menyelesaikan pembelian.
-   Terapkan pagination, sorting, filtering di server.
-   Gunakan `created_at`, `updated_at`, `created_by`, `updated_by` pada
    record penting.
-   Perubahan nominal yang berdampak pada laporan harus tersimpan dengan
    jejak audit minimum.

## 9. Entitas Data Awal

-   `users`
-   `households`
-   `household_members`
-   `refresh_sessions` atau `refresh_tokens`
-   `income_sources`
-   `income_categories`
-   `expense_categories`
-   `incomes`
-   `expenses`
-   `items` (barang inventori)
-   `stock_movements`
-   `purchases`
-   `purchase_items`
-   `debts_receivables` (atau tabel terpisah jika kompleksitas
    meningkat)
-   `debt_receivable_payments`
-   `notification_preferences`
-   `notification_events` / `outbox_events`
-   `audit_logs` (opsional sederhana untuk MVP)

Relasi inti: household memiliki banyak anggota, transaksi, barang,
pembelian, hutang/piutang, kategori, dan sumber pendapatan. Pembelian
memiliki item pembelian; item mengacu ke barang bila stok dikelola.
Pembelian selesai menghasilkan satu pengeluaran dan satu atau lebih
pergerakan stok.

## 10. API Awal

Base path: `/api/v1`

-   `POST /auth/login`
-   `POST /auth/refresh`
-   `POST /auth/logout`
-   `POST /auth/logout-all`
-   `POST /auth/password/forgot`
-   `POST /auth/password/reset`
-   `GET /household`
-   `GET|POST /income-sources`
-   `GET|POST /incomes`
-   `GET|POST /expenses`
-   `GET|POST /items`
-   `GET|POST /items/:id/stock-adjustments`
-   `GET|POST /purchases`
-   `POST /purchases/:id/complete`
-   `POST /purchases/:id/cancel`
-   `GET|POST /debts-receivables`
-   `POST /debts-receivables/:id/payments`
-   `GET /reports/monthly`
-   `GET /reports/yearly`
-   `GET|PUT /settings/notifications`

Tambahkan endpoint detail/update/archive sesuai kebutuhan. Gunakan
DTO/schema validation, response konsisten, OpenAPI/Swagger, dan versi
API.

## 11. Non-Functional Requirements

### Keamanan

-   HTTPS wajib di production.
-   Cookie auth: `HttpOnly`, `Secure`, `SameSite=Lax` (atau kebijakan
    yang lebih ketat jika deployment memungkinkan), `Path=/`; hindari
    `Domain` luas bila tidak diperlukan.
-   Access token: JWT 15 menit.
-   Refresh token: maksimal 7 hari, rotasi setiap penggunaan, disimpan
    dalam cookie aman, hash token disimpan di PostgreSQL, deteksi reuse
    dan cabut token family/sesi terkait.
-   Pertimbangkan satu cookie `__Host-` bila frontend/API satu host;
    cookie prefix tersebut mensyaratkan Secure, Path `/`, tanpa Domain.
    Untuk pemisahan subdomain, rancang CORS credentials dan cookie scope
    secara sengaja.
-   Terapkan proteksi CSRF untuk endpoint yang memakai cookie (validasi
    Origin/Referer dan token CSRF sesuai arsitektur); `SameSite` saja
    bukan satu-satunya kontrol.
-   Rate limit login, refresh, reset password, dan endpoint sensitif.
-   Password di-hash dengan Argon2id atau scrypt menggunakan library
    yang terawat; jangan simpan password/token mentah.
-   Validasi input di backend; ORM query parameterized; jangan log
    token, password, data keuangan lengkap, atau kredensial provider.
-   Otorisasi household diterapkan pada setiap query/mutasi.
-   Secret disimpan dalam environment/secret manager, tidak masuk
    repository.

### Kinerja dan reliabilitas

-   Target halaman utama terasa responsif untuk household kecil;
    tetapkan baseline pengukuran saat implementasi.
-   Indeks pada `household_id`, tanggal transaksi, status, dan foreign
    key yang sering difilter.
-   Pengiriman notifikasi tidak memblokir request pengguna.
-   Backup PostgreSQL terjadwal dan uji pemulihan.
-   Error aplikasi terstruktur, logging, dan health check.
-   Migrasi database dijalankan secara terkendali saat deploy.

### Aksesibilitas dan usability

-   Form dapat digunakan dengan keyboard.
-   Label field jelas dan pesan validasi dekat field.
-   Kontras teks memadai meski menggunakan neobrutalism.
-   Layout responsif untuk ponsel dan desktop; alur tambah transaksi
    dioptimalkan untuk ponsel.

## 12. Rekomendasi Stack

### Inti

-   **Monorepo:** Turborepo + pnpm workspaces.
-   **Frontend:** Next.js App Router + TypeScript.
-   **Backend:** NestJS + TypeScript.
-   **Database:** PostgreSQL.
-   **ORM:** Drizzle ORM untuk SQL yang eksplisit dan migrasi ringan,
    atau Prisma jika tim lebih menyukai DX berbasis schema. Pilih satu,
    jangan mencampur keduanya.
-   **Validasi:** Zod pada frontend; DTO dengan
    `class-validator`/`class-transformer` di NestJS, atau gunakan
    kontrak schema bersama secara konsisten.
-   **UI:** Tailwind CSS + shadcn/ui, ditata dengan design tokens
    neobrutalism.
-   **Form:** React Hook Form + Zod.
-   **Tabel:** TanStack Table untuk daftar transaksi dan inventori.
-   **Grafik:** Recharts.
-   **Tanggal:** date-fns.
-   **Email:** Resend atau SMTP provider.
-   **WhatsApp:** Meta WhatsApp Business Platform Cloud API atau
    provider resmi.
-   **Background jobs:** mulai dengan PostgreSQL outbox + worker NestJS;
    tambahkan Redis + BullMQ jika retry/volume/penjadwalan
    membutuhkannya.
-   **Testing:** Vitest/Jest, Supertest, Playwright.
-   **API docs:** NestJS Swagger/OpenAPI.
-   **Lint/format:** ESLint + Prettier; pertimbangkan Biome bila tooling
    cocok.

### Struktur repo yang disarankan

``` text
apps/
  web/                  # Next.js
  api/                  # NestJS
  worker/               # opsional, proses outbox/notifikasi
packages/
  ui/                   # komponen bersama
  contracts/             # schema/type API bersama
  eslint-config/
  typescript-config/
  utils/
```

### Catatan arsitektur

-   Browser berkomunikasi dengan Next.js; Next.js dapat menjadi
    BFF/proxy ke NestJS agar cookie dan CORS lebih sederhana. Jika
    browser memanggil API langsung di subdomain lain, atur CORS
    credentials, cookie domain/samesite, dan CSRF secara eksplisit.
-   Jangan menyimpan access token atau refresh token di `localStorage`.
-   Bila refresh token dikirim via cookie, endpoint refresh membaca
    cookie dan mengeluarkan access token baru; token refresh baru
    ditulis kembali sebagai cookie. Untuk aplikasi browser,
    pertimbangkan access token hanya di memori/server-side BFF.
-   `Secure` harus aktif di production HTTPS. Pengembangan lokal boleh
    menggunakan konfigurasi khusus non-production, jangan menurunkan
    keamanan production.

## 13. Kriteria Penerimaan MVP

1.  Dua anggota dapat login dan mengakses household yang sama.
2.  Anggota household lain tidak dapat mengakses data dengan mengganti
    ID di URL/API.
3.  Pemasukan/pengeluaran tervalidasi dan muncul di laporan periode yang
    benar.
4.  Pembelian selesai hanya menghasilkan satu pengeluaran dan stok
    bertambah tepat sekali.
5.  Pembelian yang gagal di tengah proses tidak meninggalkan pengeluaran
    atau perubahan stok parsial.
6.  Koreksi stok tercatat dalam riwayat.
7.  Hutang/piutang menunjukkan saldo tersisa yang benar setelah
    pembayaran sebagian/penuh.
8.  Laporan bulanan/tahunan konsisten dengan transaksi yang tersimpan.
9.  Stok rendah memicu notifikasi melalui kanal yang aktif dan tidak
    mengirim duplikat pada setiap pemeriksaan.
10. Access token kedaluwarsa setelah 15 menit; refresh token kedaluwarsa
    maksimal 7 hari dan dirotasi.
11. Logout mencabut sesi refresh yang bersangkutan.
12. Form utama dapat dipakai pada viewport mobile dan desktop.
13. CSV dapat diekspor dengan filter periode yang aktif.

## 14. Risiko dan Mitigasi

  -----------------------------------------------------------------------
  Risiko                              Mitigasi
  ----------------------------------- -----------------------------------
  Pemasukan/pengeluaran tercatat      Tetapkan aturan arus kas dan
  ganda melalui pembelian dan         tautkan record sumber; gunakan
  pembayaran hutang                   idempotency

  Stok berbeda dengan riwayat         Semua perubahan stok lewat service
  pergerakan                          domain dan transaksi database

  Token dicuri atau dipakai ulang     Cookie aman, hash refresh token,
                                      rotasi, reuse detection, rate limit

  Notifikasi WhatsApp gagal atau      Provider resmi, status pengiriman,
  biaya berubah                       retry, email sebagai kanal
                                      alternatif

  MVP terlalu besar                   Fokus pada pencatatan, inventori,
                                      laporan, dan notifikasi dasar;
                                      tunda integrasi bank/OCR

  Laporan tidak dipercaya             Definisikan tanggal transaksi,
                                      aturan hutang/piutang, pembelian,
                                      dan pembatalan sejak awal
  -----------------------------------------------------------------------

## 15. Prioritas Pengerjaan

### P0 --- Fondasi

-   Monorepo, CI, PostgreSQL, migrasi, autentikasi, household,
    authorization.
-   Design system dan layout responsif.

### P1 --- Pencatatan inti

-   Kategori, sumber pendapatan, pemasukan, pengeluaran.
-   Dashboard dan laporan dasar.

### P2 --- Inventori dan pembelian

-   Master barang, stock movements, pembelian, integrasi
    pembelian→pengeluaran→stok.

### P3 --- Hutang/piutang dan laporan lanjutan

-   Saldo, pembayaran, jatuh tempo, laporan bulanan/tahunan.

### P4 --- Notifikasi dan hardening

-   Email, WhatsApp, deduplikasi, retry, ekspor CSV, pengujian keamanan
    dan end-to-end.

## 16. Keputusan yang Perlu Dikonfirmasi Sebelum Implementasi

1.  Apakah hutang/piutang hanya dicatat sebagai kewajiban, atau juga
    harus memengaruhi laporan arus kas saat dibuat?
2.  Apakah pembelian barang selalu otomatis menjadi pengeluaran, atau
    ada pembelian kredit/hutang?
3.  Kanal WhatsApp menggunakan nomor WhatsApp Business milik sendiri
    atau provider pihak ketiga resmi?
4.  Apakah kedua anggota memiliki hak edit yang sama, atau hanya pemilik
    yang dapat mengelola pengaturan?
