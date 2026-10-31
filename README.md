# RumahKita

**Household Finance & Inventory Management** — Aplikasi manajemen keuangan dan inventaris rumah tangga untuk dua anggota keluarga.

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Backend API | NestJS 10, Argon2id, JWT (HttpOnly cookies) |
| Frontend | Next.js 14 App Router, TailwindCSS, Neo-brutalism UI |
| Worker | Node.js daemon (Outbox polling pattern) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Shared | `packages/contracts` (Zod schemas), `packages/ui`, `packages/db` |

---

## Prasyarat

| Tool | Versi Minimum |
|---|---|
| [Node.js](https://nodejs.org) | `>= 20.0.0` |
| [pnpm](https://pnpm.io) | `11.25.0` (dikelola via `corepack`) |
| [Docker](https://docs.docker.com/get-docker/) | `>= 24` |
| [Docker Compose](https://docs.docker.com/compose/) | `v2` (bawaan Docker Desktop) |
| PostgreSQL | Server eksternal `>= 14` |

---

## Instalasi & Setup

### 1. Clone Repositori

```bash
git clone <repo-url> rumahkita
cd rumahkita
```

### 2. Konfigurasi Environment

Salin template dan isi nilai yang sesuai:

```bash
cp .env.example .env
```

Edit `.env` dan pastikan variabel berikut sudah benar:

```env
# Koneksi ke server PostgreSQL yang sudah ada
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>

# JWT Secrets — GANTI dengan nilai acak yang aman di production!
JWT_ACCESS_SECRET=ganti_dengan_secret_minimal_32_karakter
JWT_REFRESH_SECRET=ganti_dengan_secret_minimal_32_karakter

# URL frontend untuk CORS
CORS_ORIGIN=http://localhost:3000

# Next.js BFF — URL internal API (di dalam Docker network)
INTERNAL_API_URL=http://api:4000/api/v1
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

> [!IMPORTANT]
> `DATABASE_URL` wajib diisi. Tanpa koneksi database yang valid, semua layanan akan gagal start.

> [!CAUTION]
> Ganti `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` dengan string acak sepanjang 32+ karakter sebelum deploy ke production. Jangan gunakan nilai default dari `.env.example`.

---

## Penggunaan

### Mode Development (Lokal tanpa Docker)

```bash
# Install semua dependensi workspace
pnpm install

# Jalankan migration database
pnpm --filter @rumahkita/db db:migrate

# (Opsional) Seed data awal
pnpm --filter @rumahkita/db db:seed

# Jalankan semua app secara paralel
pnpm dev
```

Layanan akan tersedia di:

| Layanan | URL |
|---|---|
| Frontend (Web) | http://localhost:3000 |
| Backend API | http://localhost:4000/api/v1 |
| Swagger Docs | http://localhost:4000/api/docs |

---

### Mode Production (Docker)

#### Build & Jalankan Semua Layanan

```bash
docker compose up -d --build
```

#### Jalankan Migration (sekali, setelah container naik)

```bash
docker compose exec api node -e "
  require('dotenv').config();
  const { execSync } = require('child_process');
  execSync('pnpm --filter @rumahkita/db db:migrate', { stdio: 'inherit' });
"
```

Atau dari host (jika `pnpm` terinstall):

```bash
DATABASE_URL="<your-db-url>" pnpm --filter @rumahkita/db db:migrate
```

#### Cek Status Container

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose logs -f worker
```

#### Stop Semua Layanan

```bash
docker compose down
```

---

## Struktur Direktori

```
rumahkita/
├── apps/
│   ├── api/          # NestJS REST API (port 4000)
│   │   └── Dockerfile
│   ├── web/          # Next.js Frontend (port 3000)
│   │   └── Dockerfile
│   └── worker/       # Notification Worker Daemon
│       └── Dockerfile
├── packages/
│   ├── contracts/    # Zod schemas & TypeScript types (isomorphic)
│   ├── db/           # Drizzle ORM schema, migrations, seed
│   ├── ui/           # Neo-brutalism design system (Tailwind + Radix UI)
│   ├── eslint-config/
│   └── typescript-config/
├── tests/
│   ├── e2e/          # Playwright & HTTP E2E test suite (Tier 1–4)
│   └── adversarial/  # Adversarial / security stress tests
├── docker-compose.yml
├── .env.example
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Perintah Berguna

### Build

```bash
pnpm build                  # Build semua packages & apps via Turborepo
pnpm --filter @rumahkita/api build   # Build API saja
pnpm --filter @rumahkita/web build   # Build Web saja
```

### Linting & Type Check

```bash
pnpm lint
pnpm typecheck
```

### Database (Drizzle)

```bash
# Generate migration baru dari perubahan schema
pnpm --filter @rumahkita/db db:generate

# Jalankan migration
pnpm --filter @rumahkita/db db:migrate

# Seed data
pnpm --filter @rumahkita/db db:seed

# Buka Drizzle Studio (GUI browser)
pnpm --filter @rumahkita/db db:studio
```

### Testing

```bash
pnpm test               # Jalankan semua unit tests via Turborepo
pnpm --filter @rumahkita/web test    # Unit tests web
pnpm --filter @rumahkita/api test    # Unit tests API
```

### Docker Shortcuts

```bash
pnpm docker:up          # docker compose up -d
pnpm docker:down        # docker compose down
```

---

## Variabel Environment Lengkap

Lihat [`.env.example`](.env.example) untuk dokumentasi lengkap semua variabel environment yang tersedia.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | Secret untuk access token (min 32 karakter) |
| `JWT_REFRESH_SECRET` | ✅ | Secret untuk refresh token (min 32 karakter) |
| `JWT_ACCESS_EXPIRES_IN` | — | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | — | Default: `7d` |
| `API_PORT` | — | Default: `4000` |
| `WEB_PORT` | — | Default: `3000` |
| `INTERNAL_API_URL` | — | URL API dari dalam Docker network. Default: `http://api:4000/api/v1` |
| `NEXT_PUBLIC_API_URL` | — | URL API dari browser. Default: `http://localhost:3000/api` |
| `CORS_ORIGIN` | — | Default: `http://localhost:3000` |
| `WORKER_POLL_INTERVAL_MS` | — | Default: `5000` (ms) |
| `RESEND_API_KEY` | — | API key Resend untuk email (opsional, stub jika kosong) |
| `WHATSAPP_API_TOKEN` | — | Token WhatsApp API (opsional, stub jika kosong) |

---

## Arsitektur Jaringan Docker

```
Browser
  │
  ▼
[rumahkita-web :3000]  ──(BFF Proxy via INTERNAL_API_URL)──▶  [rumahkita-api :4000]
                                                                        │
                                                                        ▼
                                                              [PostgreSQL Server Eksternal]
                                                                        ▲
                                                                        │
                                                              [rumahkita-worker]
```

Semua container berjalan dalam Docker network `rumahkita-network`. Worker dan API terhubung ke server PostgreSQL eksternal melalui `DATABASE_URL`.

---

## Troubleshooting

**Container API tidak bisa connect ke database**
- Pastikan `DATABASE_URL` di `.env` mengarah ke host yang dapat diakses dari dalam Docker container (gunakan IP host atau hostname, bukan `localhost`).
- Dari dalam Docker, `localhost` merujuk ke container itu sendiri. Gunakan `host.docker.internal` (Mac/Windows) atau IP host aktual.

**Next.js build gagal**
- Pastikan `NEXT_PUBLIC_API_URL` diset sebelum build karena nilai ini di-bake ke dalam static bundle saat build time.
- Contoh: `docker compose build --build-arg NEXT_PUBLIC_API_URL=https://yourapp.com/api web`

**Port sudah digunakan**
- Ganti port lewat `.env`: `API_PORT=4001` atau `WEB_PORT=3001`.
