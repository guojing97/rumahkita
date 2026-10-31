import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Portably resolves Playwright's chromium export without hardcoded user directories.
 */
function resolveChromium(): any {
  for (const pkg of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      const mod = require(pkg);
      if (mod?.chromium) return mod.chromium;
    } catch {}
  }

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
  try {
    return await chromium.launch({ headless: true });
  } catch (initialErr: any) {
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

describe('Playwright E2E: Responsive & Multi-Breakpoint Suite (/dashboard)', () => {
  let browser: any;
  let context: any;
  let page: any;

  before(async () => {
    browser = await launchBrowser(chromium);
    context = await browser.newContext();
    page = await context.newPage();

    // Authenticate with default seeded account
    await page.goto(`${BASE_URL}/login`);
    const emailInput = page.getByLabel(/Alamat Email/i);
    const passwordInput = page.getByLabel(/Kata Sandi/i);
    const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill('budi@rumahkita.local');
    await passwordInput.fill('Password123!');
    await submitBtn.click();

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    const heading = page.getByRole('heading', { name: /Ringkasan Keuangan/i });
    await heading.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('text=Total Pemasukan').waitFor({ state: 'visible', timeout: 10000 });
  });

  after(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  test('BP-1: Mobile Sempit (360x640) - Zero Horizontal Scroll, Header Controls, StatCards, Recharts, & Lists', async () => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(600); // Allow layout and Recharts resize observer to settle

    // 1. Zero Horizontal Scroll
    const scrollInfo = await page.evaluate(`(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    })()`);

    assert.ok(
      scrollInfo.docScrollWidth <= 360,
      `Horizontal scroll terdeteksi! document.documentElement.scrollWidth (${scrollInfo.docScrollWidth}) harus <= 360`
    );
    assert.ok(
      scrollInfo.bodyScrollWidth <= 360,
      `Horizontal scroll terdeteksi! document.body.scrollWidth (${scrollInfo.bodyScrollWidth}) harus <= 360`
    );

    // Verifikasi tidak ada elemen individual yang meluap ke luar 360px
    const overflowing = await page.evaluate(`(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const bad = [];
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > 361.5) {
          bad.push({
            tag: el.tagName,
            cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 40) : '',
            right: Math.round(r.right),
          });
        }
      }
      return bad;
    })()`);

    assert.strictEqual(
      overflowing.length,
      0,
      `Elemen meluap keluar layar pada 360px: ${JSON.stringify(overflowing.slice(0, 3))}`
    );

    // 2. Header Action Controls (<select>, refresh button, transaksi button)
    const selectEl = page.locator('select');
    const refreshBtn = page.getByRole('button', { name: /Segarkan data/i });
    const transaksiBtn = page.getByRole('button', { name: /Transaksi/i });

    assert.ok(await selectEl.isVisible(), 'Period selector <select> harus terlihat');
    assert.ok(await refreshBtn.isVisible(), 'Tombol Segarkan data harus terlihat');
    assert.ok(await transaksiBtn.isVisible(), 'Tombol + Transaksi harus terlihat');

    const selectBox = await selectEl.boundingBox();
    const refreshBox = await refreshBtn.boundingBox();
    const txBox = await transaksiBtn.boundingBox();

    assert.ok(selectBox && refreshBox && txBox, 'Bounding box semua kontrol header harus tersedia');
    assert.ok(selectBox.x >= 0 && selectBox.x + selectBox.width <= 360, 'Select harus pas dalam layar 360px');
    assert.ok(refreshBox.x >= 0 && refreshBox.x + refreshBox.width <= 360, 'Tombol Refresh harus pas dalam layar 360px');
    assert.ok(txBox.x >= 0 && txBox.x + txBox.width <= 360, 'Tombol Transaksi harus pas dalam layar 360px');

    // 3. 4 StatCards: Nominal Rupiah panjang & badge status
    const statTitles = ['Total Pemasukan', 'Total Pengeluaran', 'Sisa Arus Kas', 'Perlu Belanja'];
    for (const title of statTitles) {
      const card = page.locator('.rounded-card', { hasText: title }).first();
      assert.ok(await card.isVisible(), `StatCard "${title}" harus terlihat`);
      const box = await card.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 360, `StatCard "${title}" harus berada dalam lebar layar`);
    }

    // Badge status pada StatCard (Surplus/Defisit dan Habis/Menipis)
    const cashflowBadge = page.locator('.rounded-card', { hasText: 'Sisa Arus Kas' }).locator('span.rounded-badge, span:has-text("Defisit"), span:has-text("Surplus")').first();
    assert.ok(await cashflowBadge.isVisible(), 'Badge status Sisa Arus Kas harus ter-render');
    const cashflowBadgeBox = await cashflowBadge.boundingBox();
    assert.ok(cashflowBadgeBox && cashflowBadgeBox.width >= 40, 'Badge status tidak boleh tertekan/terkompresi');

    // 4. Recharts BarChart & YAxis
    const chartContainer = page.locator('.recharts-responsive-container');
    assert.ok(await chartContainer.isVisible(), 'Container Recharts BarChart harus terlihat');
    const chartBox = await chartContainer.boundingBox();
    assert.ok(chartBox && chartBox.width <= 360, 'Lebar Recharts BarChart harus <= 360px');

    const yAxis = page.locator('.recharts-yAxis');
    assert.ok(await yAxis.isVisible(), 'Recharts YAxis harus ter-render');
    const yAxisBox = await yAxis.boundingBox();
    assert.ok(yAxisBox && yAxisBox.x >= 0 && yAxisBox.x + yAxisBox.width <= 360, 'YAxis harus terlihat di dalam canvas');

    // 5. Lists: Kebutuhan Menipis, Transaksi Terbaru, & Jatuh Tempo
    const listSectionTitles = ['Kebutuhan Menipis', 'Transaksi Terbaru', 'Jatuh Tempo Hutang & Piutang'];
    for (const headingText of listSectionTitles) {
      const section = page.getByRole('heading', { name: new RegExp(headingText, 'i') });
      assert.ok(await section.isVisible(), `Bagian list "${headingText}" harus terlihat`);
    }

    // Badges in dashboard lists (inside main) have shrink-0 and are readable
    const listBadges = await page.evaluate(`(() => {
      const mainEl = document.querySelector('main');
      if (!mainEl) return [];
      const badges = Array.from(mainEl.querySelectorAll('span.rounded-badge'));
      return badges.map(b => {
        const r = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          width: Math.round(r.width),
          height: Math.round(r.height),
          overflows: r.right > 361.5,
        };
      });
    })()`);
    assert.ok(listBadges.length > 0, 'Daftar badge status item harus ditemukan');
    for (const badge of listBadges) {
      assert.ok(!badge.overflows, `Badge "${badge.text}" tidak boleh meluap ke kanan layar`);
      assert.ok(badge.width >= 35, `Badge "${badge.text}" tertekan terlalu kecil (lebar: ${badge.width}px)`);
    }

    // Mobile Top Bar & Fixed Bottom Nav
    const topBar = page.locator('header.sticky.top-0');
    assert.ok(await topBar.isVisible(), 'Mobile Top Bar harus tampil pada mobile 360px');
    const bottomNav = page.locator('nav.fixed.bottom-0');
    assert.ok(await bottomNav.isVisible(), 'Fixed Mobile Bottom Nav harus tampil pada mobile 360px');
    const sidebar = page.locator('aside');
    assert.strictEqual(await sidebar.isVisible(), false, 'Desktop sidebar harus tersembunyi pada mobile 360px');
  });

  test('BP-2: Mobile Standar (390x844) - Zero Horizontal Scroll, 1-Column StatCards, & Fixed Bottom Nav', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);

    // 1. Zero Horizontal Scroll
    const scrollInfo = await page.evaluate(`(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    })()`);
    assert.ok(scrollInfo.docScrollWidth <= 390, `docScrollWidth (${scrollInfo.docScrollWidth}) harus <= 390`);
    assert.ok(scrollInfo.bodyScrollWidth <= 390, `bodyScrollWidth (${scrollInfo.bodyScrollWidth}) harus <= 390`);

    // 2. Tata Letak 1 Kolom StatCards (vertically stacked)
    const cardPositions = await page.evaluate(`(() => {
      const cardTitles = ['Total Pemasukan', 'Total Pengeluaran', 'Sisa Arus Kas', 'Perlu Belanja'];
      const cards = Array.from(document.querySelectorAll('.grid > .rounded-card')).slice(0, 4);
      return cards.map(c => {
        const r = c.getBoundingClientRect();
        return {
          title: c.innerText.split('\\n')[0],
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
        };
      });
    })()`);

    assert.strictEqual(cardPositions.length, 4, 'Harus ada 4 StatCard');
    for (let i = 0; i < cardPositions.length - 1; i++) {
      assert.ok(
        cardPositions[i].y < cardPositions[i + 1].y,
        `StatCard harus tertata 1 kolom vertikal: kartu ${i} (y=${cardPositions[i].y}) harus di atas kartu ${i + 1} (y=${cardPositions[i + 1].y})`
      );
      assert.ok(
        Math.abs(cardPositions[i].x - cardPositions[i + 1].x) < 5,
        `StatCard 1 kolom harus memiliki posisi X yang konsisten: ${cardPositions[i].x} vs ${cardPositions[i + 1].x}`
      );
    }

    // 3. Fixed Bottom Nav terlihat jelas
    const bottomNav = page.locator('nav.fixed.bottom-0');
    assert.ok(await bottomNav.isVisible(), 'Mobile Bottom Nav harus terlihat pada viewport 390x844');
    const bottomNavBox = await bottomNav.boundingBox();
    assert.ok(bottomNavBox && bottomNavBox.y > 700, 'Mobile Bottom Nav harus berada fixed di dasar layar');

    // Desktop sidebar tetap tersembunyi
    const sidebar = page.locator('aside');
    assert.strictEqual(await sidebar.isVisible(), false, 'Desktop sidebar harus tersembunyi pada viewport 390px');
  });

  test('BP-3: Tablet (768x1024) - Transisi Layout 2-Kolom StatCards (sm:grid-cols-2) & Mobile Shell Retention', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(600);

    // 1. Zero Horizontal Scroll
    const scrollInfo = await page.evaluate(`(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    })()`);
    assert.ok(scrollInfo.docScrollWidth <= 768, `docScrollWidth (${scrollInfo.docScrollWidth}) harus <= 768`);
    assert.ok(scrollInfo.bodyScrollWidth <= 768, `bodyScrollWidth (${scrollInfo.bodyScrollWidth}) harus <= 768`);

    // 2. Transisi Layout: StatCard 2 kolom (sm:grid-cols-2)
    const cardPositions = await page.evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.grid > .rounded-card')).slice(0, 4);
      return cards.map(c => {
        const r = c.getBoundingClientRect();
        return {
          title: c.innerText.split('\\n')[0],
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
        };
      });
    })()`);

    assert.strictEqual(cardPositions.length, 4, 'Harus ada 4 StatCard');
    const [c0, c1, c2, c3] = cardPositions;

    // Baris 1: Card 0 dan Card 1 sejajar horizontal
    assert.ok(
      Math.abs(c0.y - c1.y) < 10,
      `Baris 1 StatCards harus sejajar: Card 0 (y=${c0.y}) vs Card 1 (y=${c1.y})`
    );
    assert.ok(c0.x < c1.x, `Card 0 harus di kiri Card 1: ${c0.x} < ${c1.x}`);

    // Baris 2: Card 2 dan Card 3 sejajar horizontal
    assert.ok(
      Math.abs(c2.y - c3.y) < 10,
      `Baris 2 StatCards harus sejajar: Card 2 (y=${c2.y}) vs Card 3 (y=${c3.y})`
    );
    assert.ok(c2.x < c3.x, `Card 2 harus di kiri Card 3: ${c2.x} < ${c3.x}`);

    // Baris 2 berada di bawah Baris 1
    assert.ok(
      c2.y > c0.y + 50,
      `Baris 2 harus berada di bawah Baris 1: c2.y (${c2.y}) vs c0.y (${c0.y})`
    );

    // 3. Shell Retention (768px < 1024px lg breakpoint)
    const bottomNav = page.locator('nav.fixed.bottom-0');
    assert.ok(await bottomNav.isVisible(), 'Bottom nav harus tetap aktif pada tablet (<1024px)');
    const topBar = page.locator('header.sticky.top-0');
    assert.ok(await topBar.isVisible(), 'Mobile top bar harus tetap aktif pada tablet (<1024px)');
    const sidebar = page.locator('aside');
    assert.strictEqual(await sidebar.isVisible(), false, 'Desktop sidebar harus tersembunyi pada tablet (<1024px)');
  });

  test('BP-4: Desktop (1280x800) - Desktop Sidebar 240px, 4-Kolom StatCards, & 2-Kolom Grafik vs Widget Menipis', async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(600);

    // 1. Zero Horizontal Scroll
    const scrollInfo = await page.evaluate(`(() => {
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    })()`);
    assert.ok(scrollInfo.docScrollWidth <= 1280, `docScrollWidth (${scrollInfo.docScrollWidth}) harus <= 1280`);
    assert.ok(scrollInfo.bodyScrollWidth <= 1280, `bodyScrollWidth (${scrollInfo.bodyScrollWidth}) harus <= 1280`);

    // 2. Desktop Sidebar (Lebar 240px, posisi fixed di kiri)
    const sidebar = page.locator('aside');
    assert.ok(await sidebar.isVisible(), 'Desktop sidebar harus terlihat pada viewport 1280px');
    const sidebarBox = await sidebar.boundingBox();
    assert.ok(sidebarBox, 'Sidebar bounding box harus tersedia');
    assert.strictEqual(Math.round(sidebarBox.width), 240, `Lebar desktop sidebar harus tepat 240px (w-60), aktual: ${sidebarBox.width}px`);
    assert.strictEqual(Math.round(sidebarBox.x), 0, 'Sidebar harus berada tepat di sisi kiri layar (x=0)');

    // Bottom nav dan Top bar harus tersembunyi pada desktop
    const bottomNav = page.locator('nav.fixed.bottom-0');
    assert.strictEqual(await bottomNav.isVisible(), false, 'Mobile Bottom Nav harus tersembunyi pada desktop');
    const topBar = page.locator('header.sticky.top-0');
    assert.strictEqual(await topBar.isVisible(), false, 'Mobile Top Bar harus tersembunyi pada desktop');

    // 3. 4-Kolom StatCard (lg:grid-cols-4)
    const cardPositions = await page.evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.grid > .rounded-card')).slice(0, 4);
      return cards.map(c => {
        const r = c.getBoundingClientRect();
        return {
          title: c.innerText.split('\\n')[0],
          x: Math.round(r.x),
          y: Math.round(r.y),
          width: Math.round(r.width),
        };
      });
    })()`);

    assert.strictEqual(cardPositions.length, 4, 'Harus ada 4 StatCard pada desktop');
    const firstY = cardPositions[0].y;
    for (let i = 0; i < 4; i++) {
      assert.ok(
        Math.abs(cardPositions[i].y - firstY) < 10,
        `Semua 4 StatCard harus berada pada satu baris yang sama (y=${firstY}): kartu ${i} y=${cardPositions[i].y}`
      );
      if (i > 0) {
        assert.ok(
          cardPositions[i].x > cardPositions[i - 1].x,
          `StatCard ${i} harus di sebelah kanan StatCard ${i - 1}`
        );
      }
    }

    // 4. Layout 2 Kolom: Grafik Arus Kas (lg:col-span-2) vs Widget Kebutuhan Menipis (1 col)
    const chartAndWidget = await page.evaluate(`(() => {
      const chartCard = document.querySelector('.lg\\\\:col-span-2');
      const widgetCard = chartCard?.nextElementSibling;
      const cBox = chartCard?.getBoundingClientRect();
      const wBox = widgetCard?.getBoundingClientRect();
      return {
        chart: cBox ? { x: Math.round(cBox.x), y: Math.round(cBox.y), width: Math.round(cBox.width) } : null,
        widget: wBox ? { x: Math.round(wBox.x), y: Math.round(wBox.y), width: Math.round(wBox.width) } : null,
      };
    })()`);

    assert.ok(chartAndWidget.chart && chartAndWidget.widget, 'Kartu grafik dan widget menipis harus ter-render');
    assert.ok(
      Math.abs(chartAndWidget.chart.y - chartAndWidget.widget.y) < 15,
      `Grafik dan Widget Menipis harus berdampingan pada baris yang sama: chart Y=${chartAndWidget.chart.y} vs widget Y=${chartAndWidget.widget.y}`
    );
    assert.ok(
      chartAndWidget.chart.x < chartAndWidget.widget.x,
      'Grafik harus berada di sebelah kiri Widget Menipis'
    );
    assert.ok(
      chartAndWidget.chart.width > chartAndWidget.widget.width * 1.5,
      `Grafik (lg:col-span-2) harus lebih lebar ~2x dari Widget Menipis: chart width ${chartAndWidget.chart.width}px vs widget width ${chartAndWidget.widget.width}px`
    );

    // 5. Layout 2 Kolom Baris Bawah: Transaksi Terbaru vs Jatuh Tempo
    const bottomCards = await page.evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('.grid.grid-cols-1.lg\\\\:grid-cols-2 > .rounded-card'));
      if (cards.length < 2) return null;
      const b0 = cards[0].getBoundingClientRect();
      const b1 = cards[1].getBoundingClientRect();
      return {
        card0: { x: Math.round(b0.x), y: Math.round(b0.y), width: Math.round(b0.width) },
        card1: { x: Math.round(b1.x), y: Math.round(b1.y), width: Math.round(b1.width) },
      };
    })()`);

    assert.ok(bottomCards, 'Dua kartu baris bawah harus ter-render');
    assert.ok(
      Math.abs(bottomCards.card0.y - bottomCards.card1.y) < 15,
      `Transaksi Terbaru dan Jatuh Tempo harus sejajar horizontal di desktop: ${bottomCards.card0.y} vs ${bottomCards.card1.y}`
    );
    assert.ok(bottomCards.card0.x < bottomCards.card1.x, 'Transaksi Terbaru di sebelah kiri Jatuh Tempo');
    assert.ok(
      Math.abs(bottomCards.card0.width - bottomCards.card1.width) < 10,
      `Kedua kartu baris bawah harus berukuran seimbang: ${bottomCards.card0.width}px vs ${bottomCards.card1.width}px`
    );
  });
});
