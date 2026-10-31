# Design System & UI Specification --- Household Finance MVP

**Visual direction:** Neo-brutalism\
**Product:** Household Finance & Inventory\
**Platform:** Responsive web app (mobile-first, desktop-friendly)\
**Audience:** Two household members managing shared money and supplies

## 1. Design Intent

Buat antarmuka yang tegas, hangat, praktis, dan mudah dipindai.
Neo-brutalism dipakai melalui outline hitam tebal, bayangan keras tanpa
blur, warna aksen berani, sudut relatif kotak, dan tipografi
berkarakter. Karena aplikasi menyimpan data keuangan, visual tetap harus
rapi dan tidak mengorbankan keterbacaan.

Prinsip: 1. **Clarity over decoration:** nominal, tanggal, status, dan
aksi utama mudah ditemukan. 2. **Visible structure:** border dan
pemisahan panel tegas. 3. **Friendly household tone:** hindari bahasa
akuntansi yang rumit. 4. **Fast entry:** tambah pemasukan, pengeluaran,
dan pembelian dalam sedikit langkah. 5. **Responsive first:** tabel
berubah menjadi kartu ringkas pada layar kecil. 6. **Accessible
brutalism:** kontras kuat, fokus keyboard terlihat, warna bukan
satu-satunya penanda status.

## 2. Visual Tokens

### Warna

Gunakan warna sebagai token, jangan menulis nilai warna berulang di
komponen.

  Token           Nilai       Penggunaan
  --------------- ----------- -----------------------------------
  `--bg`          `#FFFDF7`   Latar utama hangat
  `--surface`     `#FFFFFF`   Kartu/form
  `--ink`         `#171717`   Teks, border, shadow
  `--muted`       `#66645F`   Teks sekunder
  `--primary`     `#C8F169`   CTA utama / highlight
  `--secondary`   `#B9D9FF`   Panel informasi
  `--accent`      `#FF8A65`   Highlight pembelian/aksi
  `--lavender`    `#D9C8FF`   Grafik atau dekorasi sekunder
  `--success`     `#287D4F`   Status sukses dengan teks kontras
  `--warning`     `#9A5700`   Status stok menipis
  `--danger`      `#B42318`   Status gagal/habis
  `--border`      `#171717`   Outline 2--3px

Catatan: status sukses/warning/danger harus selalu disertai teks atau
ikon, bukan warna saja. Pastikan kombinasi teks/latar memenuhi kontras
WCAG AA.

### Tipografi

-   **Display/headings:** `Space Grotesk` atau `Archivo`, weight
    600--700.
-   **Body/UI:** `Inter` atau `Geist Sans`, weight 400--600.
-   **Angka keuangan:** gunakan font UI dengan
    `font-variant-numeric: tabular-nums`.
-   Hindari teks kapital penuh untuk label panjang.
-   Judul ringkas; label field menggunakan bahasa Indonesia yang umum.

### Bentuk dan elevasi

-   Border utama: 2px solid `--ink`; elemen hero/CTA penting dapat
    memakai 3px.
-   Radius: 8--12px untuk kartu dan field; tombol 8px. Jangan gunakan
    pill untuk semua elemen.
-   Hard shadow: `4px 4px 0 var(--ink)`; panel besar
    `6px 6px 0 var(--ink)`.
-   Hover: geser elemen `translate(-1px, -1px)` dan shadow bertambah,
    atau tombol ditekan dengan `translate(2px, 2px)` dan shadow
    mengecil.
-   Tidak menggunakan blur shadow, glassmorphism, gradient berlebihan,
    atau animasi dekoratif yang mengganggu.

### Spacing

Gunakan skala 4/8/12/16/24/32/40/48px. Form berjarak cukup, jangan padat
seperti dashboard admin generik.

## 3. Layout dan Navigasi

### Desktop

-   Sidebar tetap, lebar 240--260px.
-   Top bar berisi judul halaman, periode aktif jika relevan, tombol
    `+ Tambah`, avatar/menu akun.
-   Konten utama dibatasi lebar nyaman, menggunakan grid 12 kolom.
-   Sidebar berisi logo/wordmark, navigasi, household switcher (meskipun
    MVP hanya satu), dan ringkasan status notifikasi.

Navigasi: 1. Dashboard 2. Transaksi - Pemasukan - Pengeluaran 3.
Pembelian 4. Barang 5. Hutang & Piutang 6. Laporan 7. Pengaturan

`Sumber Pendapatan` dan `Kategori` dapat berada di Pengaturan atau
sebagai master data di halaman terkait.

### Mobile

-   Header kompak dengan logo, nama halaman, dan avatar.
-   Navigasi bawah untuk Dashboard, Transaksi, Barang, Laporan; menu
    `Lainnya` untuk Pembelian, Hutang/Piutang, Pengaturan.
-   Tombol tambah utama terlihat jelas.
-   Form menggunakan satu kolom; tombol submit sticky di bawah bila
    panjang.
-   Tabel diganti daftar kartu; jangan memaksa horizontal scroll untuk
    alur utama.

## 4. Halaman dan Komponen

### 4.1 Login

-   Panel login terpusat dengan wordmark, judul "Urus rumah
    bareng-bareng.", deskripsi singkat.
-   Input email dan password dengan label permanen.
-   Tombol `Masuk` berwarna primary, border tebal, hard shadow.
-   Link `Lupa password?`.
-   Jangan menampilkan fitur daftar publik bila akun hanya dibuat lewat
    undangan.

### 4.2 Dashboard

Susunan: 1. Greeting: "Keuangan rumah bulan ini" + pemilih periode. 2.
Empat kartu ringkasan: - Pemasukan - Pengeluaran - Sisa arus kas -
Hutang & piutang terbuka 3. Grafik pemasukan vs pengeluaran bulanan. 4.
Dua panel sejajar: - Transaksi terbaru - Barang yang perlu dibeli 5.
Panel ringkas jatuh tempo hutang/piutang.

Kartu ringkasan: - Latar putih dengan outline hitam dan hard shadow. -
Nilai rupiah paling menonjol, label jelas, perbandingan periode
sebelumnya opsional. - Jangan menggunakan hijau untuk semua angka
positif; sediakan konteks label dan ikon.

Empty state: - Ilustrasi sederhana berbasis ikon/shape, bukan ilustrasi
besar. - Copy: "Belum ada transaksi bulan ini." - CTA:
`Catat transaksi pertama`.

### 4.3 Transaksi / Pemasukan

-   Judul dan tombol `+ Tambah pemasukan`.
-   Filter periode, sumber, kategori, dan pencatat.
-   Ringkasan total di atas tabel.
-   Desktop: tabel kolom Tanggal, Sumber, Catatan, Pencatat, Nominal,
    Aksi.
-   Mobile: kartu berisi tanggal, sumber, catatan, nominal, dan menu
    aksi.
-   Form tambah/edit dalam drawer di desktop atau halaman penuh di
    mobile.
-   Nominal input diformat IDR saat ditampilkan; nilai mentah tetap
    berupa integer rupiah.
-   Konfirmasi sebelum membatalkan atau mengarsipkan data.

### 4.4 Pengeluaran

-   Pola sama dengan pemasukan.
-   Kategori dan metode pembayaran tampil sebagai label/chip dengan
    outline.
-   Transaksi yang berasal dari pembelian memiliki tautan
    `Lihat pembelian`.
-   Tandai sumber record secara jelas agar tidak membuat duplikasi.

### 4.5 Pembelian

-   Alur berorientasi tugas: tanggal, barang, kuantitas, harga satuan,
    subtotal.
-   Baris item dapat ditambah/dihapus; pencarian barang menggunakan
    combobox.
-   Ringkasan total menempel di panel bawah pada mobile.
-   Pilih kategori pengeluaran dan metode pembayaran.
-   Tombol primer `Selesaikan pembelian`; tombol sekunder
    `Simpan draft`.
-   Sebelum selesai, tampilkan konfirmasi ringkas: jumlah item, total,
    dan dampak stok.
-   Setelah berhasil, tampilkan ringkasan pembelian dan link ke
    pengeluaran yang terbentuk.
-   Bila pembelian gagal, tampilkan pesan jelas dan pertahankan input
    pengguna.

### 4.6 Barang / Inventori

-   Bagian atas: pencarian, filter status stok, filter kategori,
    `+ Tambah barang`.
-   Kartu ringkasan: Total barang aktif, stok menipis, stok habis.
-   Desktop: tabel Nama barang, Kategori, Stok, Minimum, Status, Aksi.
-   Mobile: kartu barang dengan stok besar dan status yang terlihat.
-   Status:
    -   `Aman` --- teks + ikon check.
    -   `Menipis` --- teks + ikon alert.
    -   `Habis` --- teks + ikon silang.
-   Detail barang: stok saat ini, ambang minimum, satuan, lokasi,
    riwayat pergerakan stok, tombol `Koreksi stok`, `Edit`.
-   Koreksi stok memerlukan alasan; gunakan dialog konfirmasi yang
    menjelaskan perubahan dari nilai lama ke baru.

### 4.7 Hutang & Piutang

-   Tab `Hutang` dan `Piutang`.
-   Kartu ringkasan: total saldo terbuka, jatuh tempo dekat, terlambat.
-   Daftar menampilkan pihak, sisa saldo, tanggal jatuh tempo, status.
-   Detail menampilkan nominal awal, riwayat pembayaran, saldo tersisa.
-   CTA `Catat pembayaran` untuk hutang dan `Catat penerimaan` untuk
    piutang.
-   Status overdue harus berupa teks jelas dan ikon; jangan hanya badge
    merah.
-   Dialog pencatatan pembayaran menampilkan sisa saldo dan validasi
    nominal maksimum.

### 4.8 Laporan

-   Pemilih tab `Bulanan` / `Tahunan`.
-   Filter periode dan tombol `Ekspor CSV`.
-   Kartu ringkasan pemasukan, pengeluaran, arus kas bersih.
-   Grafik batang pemasukan vs pengeluaran.
-   Grafik kategori pengeluaran dan sumber pemasukan.
-   Tabel rincian di bawah grafik.
-   Tampilkan definisi "Arus kas bersih" sebagai tooltip/teks bantuan.
-   Pada tahun berjalan, bulan tanpa data tetap ditampilkan dengan nilai
    nol agar tren mudah dibandingkan.

### 4.9 Pengaturan

Bagian: - Profil dan preferensi. - Anggota household dan undangan. -
Sumber pendapatan. - Kategori pemasukan/pengeluaran. - Notifikasi stok
rendah: email, nomor WhatsApp, kanal aktif, uji konfigurasi. -
Preferensi laporan dan zona waktu. - Keamanan: sesi aktif, logout semua
perangkat (bila tersedia).

Untuk WhatsApp, jelaskan bahwa notifikasi memerlukan konfigurasi
WhatsApp Business/provider resmi dan persetujuan pengguna.

## 5. Komponen UI

### Button

Varian: - Primary: background `--primary`, border 2px ink, hard
shadow. - Secondary: white background, border 2px ink. - Destructive:
danger background atau outline dengan label aksi spesifik. - Ghost:
tanpa shadow untuk aksi sekunder yang berulang. - Loading state dengan
spinner dan teks, nonaktifkan double-submit.

### Input / Select / Textarea

-   Label selalu terlihat di atas input.
-   Border 2px ink, background putih.
-   Focus: outline 3px `--secondary` di luar border.
-   Error: teks dan ikon di bawah field, bukan hanya border merah.
-   Placeholder sebagai contoh, bukan pengganti label.
-   Input nominal memakai prefix `Rp` secara visual.

### Card / Stat card

-   Border 2px, radius 10px, hard shadow.
-   Padding 16--24px.
-   Hindari terlalu banyak warna aksen dalam satu viewport.
-   Angka menggunakan tabular numerals.

### Badge / Status

-   Border 1.5--2px ink, radius 6px.
-   Selalu menyertakan teks.
-   Status stok dan hutang harus konsisten di semua halaman.

### Table

-   Header kontras, border bawah tebal.
-   Baris memiliki hover state.
-   Aksi utama tidak hanya berupa ikon tanpa label/tooltip.
-   Mobile berubah menjadi card list.

### Dialog / Drawer

-   Judul yang menjelaskan aksi.
-   Tombol aksi primer dan sekunder dibedakan.
-   Untuk aksi berdampak pada stok/laporan, tampilkan dampak dengan
    bahasa sederhana.
-   Dialog tidak digunakan untuk form panjang di mobile.

### Toast / Feedback

-   Sukses, peringatan, dan error punya ikon + teks.
-   Error menjelaskan langkah berikutnya jika memungkinkan.
-   Hindari menampilkan detail teknis atau stack trace.

## 6. Interaksi dan Motion

-   Durasi transisi 120--180ms.
-   Gunakan perubahan posisi/warna yang sederhana.
-   Jangan animasikan nominal keuangan secara berlebihan.
-   Hormati `prefers-reduced-motion`.
-   Setelah menyimpan transaksi, beri feedback dan perbarui
    daftar/dashboard tanpa kehilangan konteks filter.
-   Cegah submit ganda saat request berlangsung.
-   Jika API gagal, tampilkan pesan dan pertahankan input.
-   Konfirmasi khusus untuk pembatalan pembelian selesai atau koreksi
    stok besar.

## 7. Responsif dan Aksesibilitas

-   Breakpoint acuan: 640px, 768px, 1024px, 1280px.
-   Target area sentuh minimal sekitar 44×44px.
-   Semua input memiliki label dan pesan error terhubung.
-   Navigasi dan dialog bisa dioperasikan dengan keyboard.
-   Fokus terlihat jelas dan tidak dihapus.
-   Gunakan semantic HTML dan heading berurutan.
-   Grafik dilengkapi ringkasan teks atau tabel data.
-   Status tidak hanya dibedakan melalui warna.
-   Kontras teks memenuhi WCAG AA; uji khusus teks di atas warna aksen.
-   Gunakan `aria-live` untuk notifikasi hasil simpan yang penting.

## 8. Copywriting / Bahasa UI

Gunakan Bahasa Indonesia yang ringkas dan akrab, tanpa terlalu banyak
jargon.

Contoh: - `Pemasukan`, `Pengeluaran`, `Pembelian`, `Barang`, `Hutang`,
`Piutang`. - `Sisa arus kas` bukan sekadar `Profit`. - `Stok menipis`,
`Stok habis`, `Catat pembayaran`, `Selesaikan pembelian`. - Empty state:
"Belum ada barang di daftar. Tambahkan kebutuhan rumah yang ingin
dipantau." - Error: "Pembelian belum tersimpan. Data tetap tersedia,
silakan coba lagi." - Stok rendah: "Stok minyak goreng tinggal 1 liter
(batas minimum 2 liter)."

Hindari menyalahkan pengguna, pesan error generik, atau label yang tidak
menjelaskan konsekuensi.

## 9. Tech Implementation Notes

-   Next.js App Router + TypeScript.
-   Tailwind CSS dengan CSS variables untuk token visual.
-   shadcn/ui sebagai basis komponen, kemudian styling neo-brutalism
    secara konsisten.
-   React Hook Form + Zod untuk form.
-   TanStack Table untuk data grid.
-   Recharts untuk grafik.
-   Lucide icons.
-   `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`
    untuk tampilan rupiah.
-   Jangan mengandalkan client-side state sebagai sumber kebenaran
    saldo/stok.
-   Gunakan skeleton/loading state dan error boundary.
-   Jangan menggunakan warna status sebagai satu-satunya pembeda.
-   Uji tampilan pada lebar 360px, 390px, 768px, 1024px, dan desktop
    lebar.

## 10. Definition of Done UI

-   [ ] Semua halaman memiliki loading, empty, error, dan success state
    yang sesuai.
-   [ ] Alur utama bisa dijalankan pada mobile dan desktop.
-   [ ] Tidak ada tabel penting yang memaksa horizontal scroll pada
    mobile.
-   [ ] Semua form memiliki validasi, label, dan pesan error.
-   [ ] Aksi pembelian menampilkan dampak stok/pengeluaran sebelum
    konfirmasi.
-   [ ] Stok rendah dan jatuh tempo terlihat dengan label yang jelas.
-   [ ] Desain menggunakan token konsisten; tidak ada shadow blur atau
    radius acak.
-   [ ] Kontras, keyboard navigation, dan reduced motion diuji.
-   [ ] Nominal IDR dan tanggal diformat konsisten dengan locale
    Indonesia.
