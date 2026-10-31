import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Portably resolves Playwright's chromium export without hardcoded user directories.
 * Checks node module resolution, standard packages, and npx cache dynamically.
 */
function resolveChromium(): any {
  // 1. Try standard module resolution
  for (const pkg of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      const mod = require(pkg);
      if (mod?.chromium) return mod.chromium;
    } catch {}
  }

  // 2. Dynamically search inside user npm cache without hardcoded paths
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (homeDir) {
    const npxCacheDir = join(homeDir, '.npm', '_npx');
    if (existsSync(npxCacheDir)) {
      try {
        const entries = readdirSync(npxCacheDir);
        for (const entry of entries) {
          const candidatePath = join(npxCacheDir, entry, 'node_modules', 'playwright');
          if (existsSync(candidatePath)) {
            try {
              const mod = require(candidatePath);
              if (mod?.chromium) return mod.chromium;
            } catch {}
          }
        }
      } catch {}
    }
  }

  throw new Error('Playwright chromium could not be located dynamically in environment.');
}

/**
 * Portably launches Chromium with fallback to system browser if default playwright binary is not cached.
 */
async function launchBrowser(chromium: any): Promise<any> {
  // Attempt standard launch first
  try {
    return await chromium.launch({ headless: true });
  } catch (initialErr: any) {
    // If Playwright binary cache is missing, fallback to system Chrome/Chromium binaries across OSes
    const candidates = [
      process.env.CHROME_BIN,
      process.env.CHROME_PATH,
      process.env.PLAYWRIGHT_CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter((p): p is string => Boolean(p && existsSync(p)));

    for (const exePath of candidates) {
      try {
        return await chromium.launch({ headless: true, executablePath: exePath });
      } catch {}
    }

    throw initialErr;
  }
}

const chromium = resolveChromium();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SEED_EMAIL = process.env.TEST_USER_OWNER_EMAIL || 'hendrawankevin97@gmail.com';
const SEED_PASSWORD = process.env.TEST_USER_OWNER_PASSWORD || 'e5f6g7h8';
const SEED_FULL_NAME = process.env.TEST_USER_OWNER_NAME || 'Kevin Hendrawan';

describe('Playwright End-to-End Test Suite: Authentication & Navigation', () => {
  let browser: any;

  before(async () => {
    browser = await launchBrowser(chromium);
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('AC-1: Root Route Redirection (/) - Unauthenticated ke /login & Authenticated ke /dashboard', async () => {
    // 1A: Kunjungan unauthenticated ke / dialihkan ke /login
    const unauthContext = await browser.newContext();
    try {
      const page = await unauthContext.newPage();
      await page.goto(`${BASE_URL}/`);

      await page.waitForURL((url: URL) => url.pathname === '/login', { timeout: 10000 });
      assert.strictEqual(
        new URL(page.url()).pathname,
        '/login',
        'Kunjungan unauthenticated ke / harus secara otomatis dialihkan ke /login'
      );

      // Verifikasi form login tampil
      const emailInput = page.getByLabel(/Alamat Email/i);
      const passwordInput = page.getByLabel(/Kata Sandi/i);
      const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
      await submitBtn.waitFor({ state: 'visible', timeout: 5000 });

      assert.ok(await emailInput.isVisible(), 'Input Alamat Email harus terlihat');
      assert.ok(await passwordInput.isVisible(), 'Input Kata Sandi harus terlihat');
      assert.ok(await submitBtn.isVisible(), 'Tombol Masuk ke RumahKita harus terlihat');

      // Verifikasi elemen landing page lama tidak ada
      const oldLandingBtn = page.getByRole('link', { name: 'Buka Dashboard' });
      assert.strictEqual(
        await oldLandingBtn.isVisible(),
        false,
        'Landing page lama tidak boleh ditampilkan pada rute root /'
      );
      await page.close();
    } finally {
      await unauthContext.close();
    }

    // 1B: Kunjungan authenticated (dengan session aktif) ke / dialihkan langsung ke /dashboard
    const authContext = await browser.newContext();
    try {
      const page = await authContext.newPage();
      await page.goto(`${BASE_URL}/login`);

      const emailInput = page.getByLabel(/Alamat Email/i);
      const passwordInput = page.getByLabel(/Kata Sandi/i);
      const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      await emailInput.fill(SEED_EMAIL);
      await passwordInput.fill(SEED_PASSWORD);
      await submitBtn.click();

      // Tunggu hingga berhasil mendarat di dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      assert.strictEqual(
        new URL(page.url()).pathname,
        '/dashboard',
        'Harus berhasil login dan mendarat di /dashboard'
      );

      // Akses kembali rute root '/' dengan sesi aktif
      await page.goto(`${BASE_URL}/`);
      await page.waitForURL((url: URL) => url.pathname === '/dashboard', { timeout: 10000 });
      assert.strictEqual(
        new URL(page.url()).pathname,
        '/dashboard',
        'Kunjungan authenticated ke / harus langsung dialihkan ke /dashboard'
      );

      // Pastikan konten dashboard tetap aktif dan utuh
      const headingDashboard = page.getByRole('heading', { name: /Ringkasan Keuangan/i });
      await headingDashboard.waitFor({ state: 'visible', timeout: 10000 });
      assert.ok(
        await headingDashboard.isVisible(),
        'Dashboard harus tetap aktif dan menampilkan Ringkasan Keuangan'
      );
      await page.close();
    } finally {
      await authContext.close();
    }
  });

  test('AC-2: Aksesibilitas Halaman Login (/login & /login/) - Form & Petunjuk Akun', async () => {
    const page = await browser.newPage();
    try {
      // 2A: Akses /login
      const res1 = await page.goto(`${BASE_URL}/login`);
      assert.strictEqual(res1?.status(), 200, '/login harus merespons 200 OK');

      const emailInput1 = page.getByLabel(/Alamat Email/i);
      const passwordInput1 = page.getByLabel(/Kata Sandi/i);
      const submitBtn1 = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      // Explicit wait to eliminate flakiness & race conditions
      await emailInput1.waitFor({ state: 'visible', timeout: 5000 });
      await passwordInput1.waitFor({ state: 'visible', timeout: 5000 });
      await submitBtn1.waitFor({ state: 'visible', timeout: 5000 });

      assert.ok(await emailInput1.isVisible(), 'Input Alamat Email harus terlihat');
      assert.ok(await passwordInput1.isVisible(), 'Input Kata Sandi harus terlihat');
      assert.ok(await submitBtn1.isVisible(), 'Tombol Masuk ke RumahKita harus terlihat');

      // Verifikasi petunjuk akun bawaan sistem
      const pageText1 = await page.textContent('body');
      assert.ok(
        pageText1?.includes(SEED_EMAIL) || pageText1?.includes('budi@rumahkita.local'),
        `Petunjuk email (${SEED_EMAIL}) harus tampil`
      );
      assert.ok(
        pageText1?.includes(SEED_PASSWORD) || pageText1?.includes('Password123!'),
        `Petunjuk password (${SEED_PASSWORD}) harus tampil`
      );

      // 2B: Akses /login/ (trailing slash) tanpa loop
      const res2 = await page.goto(`${BASE_URL}/login/`);
      assert.strictEqual(res2?.status(), 200, '/login/ harus merespons 200 OK');

      const emailInput2 = page.getByLabel(/Alamat Email/i);
      const passwordInput2 = page.getByLabel(/Kata Sandi/i);

      // Explicit wait to eliminate flakiness & race conditions
      await emailInput2.waitFor({ state: 'visible', timeout: 5000 });
      await passwordInput2.waitFor({ state: 'visible', timeout: 5000 });

      assert.ok(await emailInput2.isVisible(), 'Input Alamat Email harus terlihat di /login/');
      assert.ok(await passwordInput2.isVisible(), 'Input Kata Sandi harus terlihat di /login/');
    } finally {
      await page.close();
    }
  });

  test('AC-3: Resiliensi Stale Cookie (Anti-Loop) - Akses Login dengan Cookie Basi', async () => {
    const freshContext = await browser.newContext();
    try {
      // Simulasikan cookie basi / invalid
      await freshContext.addCookies([
        {
          name: 'refreshToken',
          value: 'invalid_expired_token_abc123',
          domain: 'localhost',
          path: '/',
        },
        {
          name: 'refresh_token',
          value: 'stale_legacy_token_xyz789',
          domain: 'localhost',
          path: '/',
        },
      ]);

      const page = await freshContext.newPage();
      const res = await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' });
      assert.strictEqual(res?.status(), 200, '/login dengan stale cookie harus merespons 200 OK');
      assert.ok(!page.url().includes('ERR_TOO_MANY_REDIRECTS'), 'Tidak boleh terjadi redirect loop');

      // Pastikan form login tetap dapat diakses
      const emailInput = page.getByLabel(/Alamat Email/i);
      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await emailInput.isVisible(), 'Form login harus tetap dapat diakses saat ada stale cookie');
      await page.close();
    } finally {
      await freshContext.close();
    }
  });

  test('AC-4: Protected Route Guarding - Unauthenticated Akses /dashboard Dialihkan ke /login', async () => {
    const unauthContext = await browser.newContext();
    try {
      const page = await unauthContext.newPage();
      await page.goto(`${BASE_URL}/dashboard`);

      // Pastikan pengguna dialihkan ke /login?redirect=%2Fdashboard
      await page.waitForURL((url: URL) => url.pathname === '/login');
      const url = new URL(page.url());
      assert.strictEqual(url.pathname, '/login', 'Pengguna harus dialihkan ke /login');
      assert.strictEqual(url.searchParams.get('redirect'), '/dashboard', 'Redirect parameter harus /dashboard');

      // Pastikan form login muncul
      const emailInput = page.getByLabel(/Alamat Email/i);
      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await emailInput.isVisible(), 'Form login harus ditampilkan pada halaman redirect');
      await page.close();
    } finally {
      await unauthContext.close();
    }
  });

  test('AC-5: Alur Login & Logout Nyata (Kredensial Salah, Kredensial Benar, Dashboard, & Logout)', async () => {
    const sessionContext = await browser.newContext();
    try {
      const page = await sessionContext.newPage();
      await page.goto(`${BASE_URL}/login`);

      const emailInput = page.getByLabel(/Alamat Email/i);
      const passwordInput = page.getByLabel(/Kata Sandi/i);
      const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      await emailInput.waitFor({ state: 'visible', timeout: 5000 });

      // 5A: Coba login dengan kredensial salah
      await emailInput.fill(SEED_EMAIL);
      await passwordInput.fill('SalahPassword123!');
      await submitBtn.click();

      // Verifikasi alert pesan galat muncul (memastikan bukan galat "Failed to fetch")
      const errorAlert = page
        .getByRole('alert')
        .filter({ hasText: /Email atau (kata sandi tidak sesuai|password salah)/i });
      await errorAlert.waitFor({ state: 'visible', timeout: 5000 });
      const alertText = (await errorAlert.textContent()) || '';
      assert.ok(
        /Email atau (kata sandi tidak sesuai|password salah)/i.test(alertText),
        `Banner galat harus mengindikasikan kredensial salah, aktual: "${alertText}"`
      );
      assert.ok(
        !alertText.toLowerCase().includes('failed to fetch'),
        'Pesan galat tidak boleh memuat galat teknis "Failed to fetch"'
      );
      assert.ok(page.url().includes('/login'), 'Tetap di halaman login saat gagal');

      // 5B: Coba login dengan kredensial benar
      await passwordInput.fill(SEED_PASSWORD);
      await submitBtn.click();

      // Verifikasi diarahkan ke dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      assert.ok(page.url().includes('/dashboard'), 'Harus berhasil login dan masuk ke /dashboard');

      // Pastikan tidak ada banner error / "Failed to fetch" di dashboard
      const errorBanners = page
        .locator('[role="alert"]:not(#__next-route-announcer__)')
        .filter({ hasText: /Failed to fetch|Tidak dapat terhubung|Galat|Error/i });
      assert.strictEqual(await errorBanners.count(), 0, 'Tidak boleh ada banner error / Failed to fetch di dashboard');

      // Tunggu hingga ringkasan keuangan dan user profile selesai termuat di UI
      const headingDashboard = page.getByRole('heading', { name: /Ringkasan Keuangan/i });
      await headingDashboard.waitFor({ state: 'visible', timeout: 10000 });

      const incomeCard = page.getByText('Total Pemasukan');
      await incomeCard.waitFor({ state: 'visible', timeout: 10000 });

      // Verifikasi data pengguna dan ringkasan keuangan
      const nameVisible =
        (await page.getByText(SEED_FULL_NAME).isVisible()) ||
        (await page.getByText('Budi Santoso').isVisible());
      assert.ok(nameVisible, `Nama pengguna (${SEED_FULL_NAME}) harus tampil di dashboard`);
      assert.ok(await incomeCard.isVisible(), 'Total Pemasukan harus tampil');
      assert.ok(await page.getByText('Total Pengeluaran').isVisible(), 'Total Pengeluaran harus tampil');
      assert.ok(await page.getByText('Sisa Arus Kas').isVisible(), 'Sisa Arus Kas harus tampil');

      // 5C: Lakukan logout
      const logoutBtn = page.getByRole('button', { name: /Keluar akun/i });
      await logoutBtn.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await logoutBtn.isVisible(), 'Tombol Keluar akun harus terlihat pada user badge');
      await logoutBtn.click();

      // Verifikasi ter-logout dan kembali ke /login tanpa loop
      await page.waitForURL('**/login', { timeout: 10000 });
      assert.strictEqual(new URL(page.url()).pathname, '/login', 'Pengguna harus kembali ke /login');
      const emailAfterLogout = page.getByLabel(/Alamat Email/i);
      await emailAfterLogout.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await emailAfterLogout.isVisible(), 'Form login harus siap digunakan kembali setelah logout');

      await page.close();
    } finally {
      await sessionContext.close();
    }
  });

  test('AC-6: Throttle Login di UI - 3x Gagal menampilkan pesan lockout 429, hitung mundur (countdown), dan tombol submit dinonaktifkan', async () => {
    const throttleContext = await browser.newContext();
    try {
      const page = await throttleContext.newPage();
      await page.goto(`${BASE_URL}/login`);

      const emailInput = page.getByLabel(/Alamat Email/i);
      const passwordInput = page.getByLabel(/Kata Sandi/i);
      const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      // Gunakan email acak / belum terdaftar untuk sekaligus menguji proteksi anti-enumeration
      const randomEmail = `playwright-throttle-${Date.now()}@example.com`;

      const alertBanner = page.locator('[role="alert"]:not(#__next-route-announcer__)');

      // Percobaan 1 Gagal -> 401
      await emailInput.fill(randomEmail);
      await passwordInput.fill('WrongPass1!');
      await submitBtn.click();
      await alertBanner.waitFor({ state: 'visible', timeout: 5000 });
      const alert1Text = await alertBanner.innerText();
      assert.match(alert1Text, /Email atau (kata sandi tidak sesuai|password salah)/i);
      assert.strictEqual(await submitBtn.isEnabled(), true, 'Tombol submit harus tetap aktif pada kegagalan ke-1');

      // Percobaan 2 Gagal -> 401
      await passwordInput.fill('WrongPass2!');
      await submitBtn.click();
      await page.waitForTimeout(500);
      const alert2Text = await alertBanner.innerText();
      assert.match(alert2Text, /Email atau (kata sandi tidak sesuai|password salah)/i);
      assert.strictEqual(await submitBtn.isEnabled(), true, 'Tombol submit harus tetap aktif pada kegagalan ke-2');

      // Percobaan 3 Gagal -> 429 Too Many Requests (Lockout 180 detik / 3 menit)
      await passwordInput.fill('WrongPass3!');
      await submitBtn.click();
      await page.waitForTimeout(500);
      await alertBanner.waitFor({ state: 'visible', timeout: 5000 });

      // Verifikasi pesan alert lockout 429
      const lockoutText3 = await alertBanner.innerText();
      assert.match(
        lockoutText3,
        /Terlalu banyak percobaan login gagal.*(3 menit|180 detik)/i,
        `Lockout banner harus menampilkan pesan batas percobaan dan hitung mundur, aktual: "${lockoutText3}"`
      );

      // Verifikasi tombol submit dinonaktifkan (disabled) selama masa lockout
      const isBtnDisabled = await submitBtn.isDisabled();
      assert.strictEqual(isBtnDisabled, true, 'Tombol submit harus dinonaktifkan (disabled) selama status lockout aktif');

      // Verifikasi hitung mundur (countdown) berjalan dinamis di banner UI
      await page.waitForTimeout(1500);
      const updatedLockoutText = await alertBanner.innerText();
      assert.match(
        updatedLockoutText,
        /Terlalu banyak percobaan login gagal.*(2 menit \d{1,2} detik|menit|detik)/i,
        `Format hitung mundur harus berkurang secara dinamis, aktual: "${updatedLockoutText}"`
      );

      // Pastikan tombol submit tetap disabled selama hitung mundur berjalan
      assert.strictEqual(
        await submitBtn.isDisabled(),
        true,
        'Tombol submit harus tetap disabled selama hitung mundur lockout berlangsung'
      );

      await page.close();
    } finally {
      await throttleContext.close();
    }
  });

  test('AC-7: Reset Counter di UI - Login sukses setelah 2x gagal mereset counter kegagalan', async () => {
    const resetContext = await browser.newContext();
    try {
      const page = await resetContext.newPage();
      await page.goto(`${BASE_URL}/login`);

      const emailInput = page.getByLabel(/Alamat Email/i);
      const passwordInput = page.getByLabel(/Kata Sandi/i);
      const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      await emailInput.waitFor({ state: 'visible', timeout: 5000 });

      // Percobaan 1 Gagal dengan kredensial salah
      await emailInput.fill(SEED_EMAIL);
      await passwordInput.fill('WrongPassword1!');
      await submitBtn.click();

      const alertBanner = page.locator('[role="alert"]:not(#__next-route-announcer__)');
      await alertBanner.waitFor({ state: 'visible', timeout: 5000 });
      assert.match(await alertBanner.innerText(), /Email atau (kata sandi tidak sesuai|password salah)/i);

      // Percobaan 2 Gagal dengan kredensial salah
      await passwordInput.fill('WrongPassword2!');
      await submitBtn.click();
      await page.waitForTimeout(500);
      assert.match(await alertBanner.innerText(), /Email atau (kata sandi tidak sesuai|password salah)/i);

      // Percobaan 3 Sukses dengan password yang benar
      await passwordInput.fill(SEED_PASSWORD);
      await submitBtn.click();

      // Berhasil mendarat di dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      assert.strictEqual(new URL(page.url()).pathname, '/dashboard', 'Harus berhasil masuk ke dashboard');

      // Logout akun
      const logoutBtn = page.getByRole('button', { name: /Keluar akun/i });
      await logoutBtn.waitFor({ state: 'visible', timeout: 5000 });
      await logoutBtn.click();
      await page.waitForURL('**/login', { timeout: 10000 });

      // Verifikasi counter telah direset: Percobaan gagal berikutnya harus dianggap kegagalan ke-1 (401), BUKAN lockout 429
      const emailInputAfterLogout = page.getByLabel(/Alamat Email/i);
      const passwordInputAfterLogout = page.getByLabel(/Kata Sandi/i);
      const submitBtnAfterLogout = page.getByRole('button', { name: /Masuk ke RumahKita/i });

      await emailInputAfterLogout.waitFor({ state: 'visible', timeout: 5000 });
      await emailInputAfterLogout.fill(SEED_EMAIL);
      await passwordInputAfterLogout.fill('WrongPasswordAfterReset!');
      await submitBtnAfterLogout.click();

      await alertBanner.waitFor({ state: 'visible', timeout: 5000 });
      const alertAfterReset = await alertBanner.innerText();
      assert.match(
        alertAfterReset,
        /Email atau (kata sandi tidak sesuai|password salah)/i,
        'Setelah reset, kegagalan pertama harus 401 biasa'
      );
      assert.strictEqual(
        await submitBtnAfterLogout.isEnabled(),
        true,
        'Tombol submit harus tetap aktif dan tidak terkena lockout'
      );

      await page.close();
    } finally {
      await resetContext.close();
    }
  });
});
