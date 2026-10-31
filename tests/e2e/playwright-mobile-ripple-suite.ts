import { test, describe, before, after, beforeEach } from 'node:test';
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
 * Launches Chromium with system browser fallback.
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
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13/14 standard
const TEST_USER = {
  email: 'hendrawankevin97@gmail.com',
  password: 'e5f6g7h8',
};

async function loginUser(page: any) {
  await page.goto(`${BASE_URL}/login`);
  const emailInput = page.getByLabel(/Alamat Email/i);
  const passwordInput = page.getByLabel(/Kata Sandi/i);
  const submitBtn = page.getByRole('button', { name: /Masuk ke RumahKita/i });

  await emailInput.waitFor({ state: 'visible', timeout: 5000 });
  await emailInput.fill(TEST_USER.email);
  await passwordInput.fill(TEST_USER.password);
  await submitBtn.click();

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  const bottomNav = page.locator('nav.fixed.bottom-0');
  await bottomNav.waitFor({ state: 'visible', timeout: 10000 });
}

async function ensureDashboard(page: any) {
  const bottomNav = page.locator('nav.fixed.bottom-0');
  const isNavVisible = await bottomNav.isVisible().catch(() => false);

  if (isNavVisible) {
    if (!page.url().endsWith('/dashboard')) {
      const dashLink = bottomNav.getByRole('link', { name: /Dashboard/i });
      await dashLink.click();
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      // Allow ripple to finish fading
      await page.waitForTimeout(650);
    }
  } else {
    if (page.url().includes('/login')) {
      await loginUser(page);
    } else {
      await page.goto(`${BASE_URL}/dashboard`);
      await bottomNav.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(650);
    }
  }
}

describe('Playwright E2E: Mobile Navigation Ripple Effect & Interaction Suite', () => {
  let browser: any;
  let context: any;
  let page: any;

  before(async () => {
    browser = await launchBrowser(chromium);
    context = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    page = await context.newPage();
    await loginUser(page);
  });

  after(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  beforeEach(async () => {
    await ensureDashboard(page);
  });

  // =========================================================================
  // TC-1: Mobile Bottom Navigation Items Ripple & Smooth Routing
  // =========================================================================
  describe('1. MobileBottomNav Ripple & Routing Interaction', () => {
    test('MobileBottomNav is visible in mobile viewport and contains all primary items', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await bottomNav.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await bottomNav.isVisible(), 'Mobile bottom nav must be visible at 390x844 viewport');

      const items = ['Dashboard', 'Transaksi', 'Inventori', 'Laporan', 'Lainnya'];
      for (const item of items) {
        if (item === 'Lainnya') {
          const btn = bottomNav.getByRole('button', { name: new RegExp(item, 'i') });
          assert.ok(await btn.isVisible(), `Nav item "${item}" button must be visible`);
        } else {
          const link = bottomNav.getByRole('link', { name: new RegExp(item, 'i') });
          assert.ok(await link.isVisible(), `Nav item "${item}" link must be visible`);
        }
      }
    });

    test('Clicking Transaksi tab triggers .animate-ripple element and navigates to /transaksi', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const transaksiLink = bottomNav.getByRole('link', { name: /Transaksi/i });
      const box = await transaksiLink.boundingBox();
      assert.ok(box, 'Transaksi link bounding box must exist');

      // Pointerdown on Transaksi tab
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      // Verify ripple element is mounted in DOM with .animate-ripple
      const ripple = transaksiLink.locator('.animate-ripple');
      const rippleCount = await ripple.count();
      assert.ok(rippleCount >= 1, 'Ripple element with .animate-ripple must be present during pointerdown');

      // Verify ripple styling (absolute, rounded-full)
      const isRoundedFull = await ripple.first().evaluate((el: HTMLElement) =>
        el.classList.contains('rounded-full') && el.classList.contains('absolute')
      );
      assert.ok(isRoundedFull, 'Ripple element must have absolute rounded-full classes');

      // Complete click and verify navigation
      await page.mouse.up();
      await page.waitForURL('**/transaksi', { timeout: 5000 });
      assert.ok(page.url().includes('/transaksi'), 'URL must transition to /transaksi');

      // Verify Transaksi tab is now active (font-bold)
      const isActiveClass = await transaksiLink.evaluate((el: HTMLElement) =>
        el.classList.contains('font-bold')
      );
      assert.ok(isActiveClass, 'Transaksi tab should have active font-bold styling');
    });

    test('Clicking Inventori tab triggers .animate-ripple and navigates to /inventori', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const inventoriLink = bottomNav.getByRole('link', { name: /Inventori/i });
      const box = await inventoriLink.boundingBox();
      assert.ok(box, 'Inventori link bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = inventoriLink.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Inventori tab');

      await page.mouse.up();
      await page.waitForURL('**/inventori', { timeout: 5000 });
      assert.ok(page.url().includes('/inventori'), 'URL must transition to /inventori');
    });

    test('Clicking Laporan tab triggers .animate-ripple and navigates to /laporan', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const laporanLink = bottomNav.getByRole('link', { name: /Laporan/i });
      const box = await laporanLink.boundingBox();
      assert.ok(box, 'Laporan link bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = laporanLink.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Laporan tab');

      await page.mouse.up();
      await page.waitForURL('**/laporan', { timeout: 5000 });
      assert.ok(page.url().includes('/laporan'), 'URL must transition to /laporan');
    });

    test('Clicking Dashboard tab from another route returns smoothly to /dashboard with ripple', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      // Navigate to /laporan via bottom nav tab
      const laporanLink = bottomNav.getByRole('link', { name: /Laporan/i });
      await laporanLink.click();
      await page.waitForURL('**/laporan', { timeout: 5000 });
      await page.waitForTimeout(650);

      const dashboardLink = bottomNav.getByRole('link', { name: /Dashboard/i });
      const box = await dashboardLink.boundingBox();
      assert.ok(box, 'Dashboard link bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = dashboardLink.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Dashboard tab');

      await page.mouse.up();
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      assert.ok(page.url().includes('/dashboard'), 'URL must transition back to /dashboard');
    });

    test('Ripple color variant differentiates active (primary: 0.20) vs inactive (neutral: 0.12)', async () => {
      // Ensure all previous ripples have settled
      await page.waitForTimeout(650);

      const bottomNav = page.locator('nav.fixed.bottom-0');
      const dashboardLink = bottomNav.getByRole('link', { name: /Dashboard/i }); // Currently active
      const transaksiLink = bottomNav.getByRole('link', { name: /Transaksi/i }); // Currently inactive

      // 1. Trigger ripple on active Dashboard link
      const dashBox = await dashboardLink.boundingBox();
      await page.mouse.move(dashBox!.x + dashBox!.width / 2, dashBox!.y + dashBox!.height / 2);
      await page.mouse.down();
      const dashRipple = dashboardLink.locator('.animate-ripple').first();
      const activeColor = await dashRipple.evaluate((el: HTMLElement) => window.getComputedStyle(el).backgroundColor);
      await page.mouse.up();
      await page.waitForTimeout(650);

      // 2. Trigger ripple on inactive Transaksi link
      const txBox = await transaksiLink.boundingBox();
      await page.mouse.move(txBox!.x + txBox!.width / 2, txBox!.y + txBox!.height / 2);
      await page.mouse.down();
      const txRipple = transaksiLink.locator('.animate-ripple').first();
      const inactiveColor = await txRipple.evaluate((el: HTMLElement) => window.getComputedStyle(el).backgroundColor);
      await page.mouse.up();
      await page.waitForTimeout(650);

      // Active uses primary: rgba(23, 23, 23, 0.2), Inactive uses neutral: rgba(23, 23, 23, 0.12)
      assert.ok(
        activeColor.includes('0.2') || activeColor === 'rgba(23, 23, 23, 0.2)',
        `Active tab ripple color should use primary alpha 0.2, got: ${activeColor}`
      );
      assert.ok(
        inactiveColor.includes('0.12') || inactiveColor === 'rgba(23, 23, 23, 0.12)',
        `Inactive tab ripple color should use neutral alpha 0.12, got: ${inactiveColor}`
      );
    });
  });

  // =========================================================================
  // TC-2: MoreMenuDrawer Ripple & Sub-Item Navigation
  // =========================================================================
  describe('2. MoreMenuDrawer Interaction & Sub-Item Ripple Routing', () => {
    test('Clicking Lainnya button triggers ripple and opens MoreMenuDrawer modal', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const moreBtn = bottomNav.getByRole('button', { name: /Lainnya/i });
      const box = await moreBtn.boundingBox();
      assert.ok(box, 'Lainnya button bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = moreBtn.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Lainnya button');

      await page.mouse.up();

      // Drawer dialog should become visible
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 4000 });
      assert.ok(await dialog.isVisible(), 'MoreMenuDrawer dialog must be visible');

      // Close drawer by pressing Escape for next tests
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 3000 });
      await page.waitForTimeout(300);
    });

    test('Clicking "Hutang & Piutang" in drawer triggers ripple and navigates to /hutang', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await bottomNav.getByRole('button', { name: /Lainnya/i }).click();

      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 3000 });

      const hutangItem = dialog.getByRole('link', { name: /Hutang & Piutang/i });
      await hutangItem.waitFor({ state: 'visible', timeout: 3000 });

      const box = await hutangItem.boundingBox();
      assert.ok(box, 'Hutang item bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = hutangItem.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Hutang item');

      await page.mouse.up();
      await page.waitForURL('**/hutang', { timeout: 5000 });
      assert.ok(page.url().includes('/hutang'), 'URL must navigate to /hutang');

      // Drawer should be automatically closed on click
      await dialog.waitFor({ state: 'hidden', timeout: 3000 });
      assert.ok(!(await dialog.isVisible()), 'Drawer must close after clicking menu item');
    });

    test('Clicking "Laporan & Ekspor CSV" in drawer triggers ripple and navigates to /laporan', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await bottomNav.getByRole('button', { name: /Lainnya/i }).click();

      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 3000 });

      const laporanItem = dialog.getByRole('link', { name: /Laporan & Ekspor CSV/i });
      await laporanItem.waitFor({ state: 'visible', timeout: 3000 });

      const box = await laporanItem.boundingBox();
      assert.ok(box, 'Laporan item bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = laporanItem.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Laporan drawer item');

      await page.mouse.up();
      await page.waitForURL('**/laporan', { timeout: 5000 });
      assert.ok(page.url().includes('/laporan'), 'URL must navigate to /laporan');
    });

    test('Clicking "Pengaturan Rumah Tangga" in drawer triggers ripple and navigates to /pengaturan', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await bottomNav.getByRole('button', { name: /Lainnya/i }).click();

      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 3000 });

      const pengaturanItem = dialog.getByRole('link', { name: /Pengaturan Rumah Tangga/i });
      await pengaturanItem.waitFor({ state: 'visible', timeout: 3000 });

      const box = await pengaturanItem.boundingBox();
      assert.ok(box, 'Pengaturan item bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = pengaturanItem.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Pengaturan drawer item');

      await page.mouse.up();
      await page.waitForURL('**/pengaturan', { timeout: 5000 });
      assert.ok(page.url().includes('/pengaturan'), 'URL must navigate to /pengaturan');
    });

    test('User Logout button in drawer has ripple container and triggers ripple effect without logging out', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await bottomNav.getByRole('button', { name: /Lainnya/i }).click();

      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible', timeout: 3000 });

      const logoutBtn = dialog.getByRole('button', { name: /Keluar/i });
      await logoutBtn.waitFor({ state: 'visible', timeout: 3000 });

      const box = await logoutBtn.boundingBox();
      assert.ok(box, 'Logout button bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = logoutBtn.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Logout button');

      // Move mouse away before pointerup to cancel the click and prevent logout
      await page.mouse.move(0, 0);
      await page.mouse.up();

      // Close drawer via Escape
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden', timeout: 3000 });
      assert.ok(!page.url().includes('/login'), 'User must remain authenticated');
    });
  });

  // =========================================================================
  // TC-3: MobileTopBar Ripple Interaction
  // =========================================================================
  describe('3. MobileTopBar Ripple Interaction', () => {
    test('MobileTopBar branding link triggers ripple and navigates to /dashboard', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      // Navigate to /transaksi first via bottom nav tab
      await bottomNav.getByRole('link', { name: /Transaksi/i }).click();
      await page.waitForURL('**/transaksi', { timeout: 5000 });
      await page.waitForTimeout(650);

      const header = page.locator('header.sticky');
      await header.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await header.isVisible(), 'MobileTopBar header must be visible in mobile viewport');

      const brandingLink = header.locator('a[href="/dashboard"]').first();
      assert.ok(await brandingLink.isVisible(), 'Branding link must be visible');

      const box = await brandingLink.boundingBox();
      assert.ok(box, 'Branding link bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = brandingLink.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in MobileTopBar branding link');

      await page.mouse.up();
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      assert.ok(page.url().includes('/dashboard'), 'URL must be /dashboard');
    });

    test('MobileTopBar Home icon button triggers ripple and links to /dashboard', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      // Navigate to /inventori first via bottom nav tab
      await bottomNav.getByRole('link', { name: /Inventori/i }).click();
      await page.waitForURL('**/inventori', { timeout: 5000 });
      await page.waitForTimeout(650);

      const header = page.locator('header.sticky');
      await header.waitFor({ state: 'visible', timeout: 5000 });
      const homeLink = header.getByRole('link', { name: /Beranda/i });
      await homeLink.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await homeLink.isVisible(), 'Home icon link must be visible');

      const box = await homeLink.boundingBox();
      assert.ok(box, 'Home link bounding box must exist');

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      const ripple = homeLink.locator('.animate-ripple');
      assert.ok((await ripple.count()) >= 1, 'Ripple must appear in Home icon link');

      await page.mouse.up();
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      assert.ok(page.url().includes('/dashboard'), 'URL must be /dashboard');
    });
  });

  // =========================================================================
  // TC-4: Accessibility & Pointer Event Isolation
  // =========================================================================
  describe('4. Accessibility, Non-Interference, & Lifecycle Cleanup', () => {
    test('All ripple containers have aria-hidden="true" and pointer-events: none', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await bottomNav.waitFor({ state: 'visible', timeout: 5000 });

      const navButtons = bottomNav.locator('a, button');
      const count = await navButtons.count();
      assert.ok(count >= 5, `Should have at least 5 nav items in bottom nav, found ${count}`);

      for (let i = 0; i < count; i++) {
        const item = navButtons.nth(i);
        const container = item.locator('span[aria-hidden="true"]');
        assert.ok((await container.count()) >= 1, `Nav item ${i} must have a ripple container`);

        const ariaHidden = await container.getAttribute('aria-hidden');
        assert.equal(ariaHidden, 'true', `Ripple container for nav item ${i} must have aria-hidden="true"`);

        const pointerEvents = await container.evaluate((el: HTMLElement) =>
          window.getComputedStyle(el).pointerEvents
        );
        assert.equal(pointerEvents, 'none', `Ripple container for nav item ${i} must have pointer-events: none`);
      }
    });

    test('Active ripple element (.animate-ripple) has pointer-events: none and does not block touch', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const txLink = bottomNav.getByRole('link', { name: /Transaksi/i });
      const box = await txLink.boundingBox();

      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();

      const rippleElement = txLink.locator('.animate-ripple').first();
      const ripplePointerEvents = await rippleElement.evaluate((el: HTMLElement) =>
        window.getComputedStyle(el).pointerEvents
      );
      assert.equal(
        ripplePointerEvents,
        'none',
        '.animate-ripple element must have pointer-events: none so it does not capture gestures'
      );

      await page.mouse.up();
      await page.waitForTimeout(650);
    });

    test('Ripple DOM elements are excluded from accessibility tree (ariaSnapshot)', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const txLink = bottomNav.getByRole('link', { name: /Transaksi/i });
      const box = await txLink.boundingBox();

      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();

      // Inspect ariaSnapshot during active ripple
      const snapshot = await txLink.ariaSnapshot();
      assert.ok(!snapshot.includes('ripple'), 'ariaSnapshot must not contain ripple elements');
      assert.ok(!snapshot.includes('animate-ripple'), 'ariaSnapshot must not contain animate-ripple');

      await page.mouse.up();
      await page.waitForTimeout(650);
    });

    test('Rapid consecutive taps spawn multiple ripples without freezing or throwing errors', async () => {
      // Ensure settled before starting
      await page.waitForTimeout(650);

      const bottomNav = page.locator('nav.fixed.bottom-0');
      const dashboard = bottomNav.getByRole('link', { name: /Dashboard/i });
      const box = await dashboard.boundingBox();

      // Trigger 3 fast taps in succession
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await page.mouse.down();
      await page.mouse.up();
      await page.mouse.down();

      const rippleCount = await dashboard.locator('.animate-ripple').count();
      assert.equal(rippleCount, 3, 'Rapid triple tap should mount 3 concurrent ripple elements');

      await page.mouse.up();
    });

    test('Ripples are automatically cleaned up from DOM upon animation completion', async () => {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const dashboard = bottomNav.getByRole('link', { name: /Dashboard/i });

      // Wait 650ms (duration 500ms + 100ms safety margin)
      await page.waitForTimeout(650);

      const remainingRipples = await dashboard.locator('.animate-ripple').count();
      assert.equal(
        remainingRipples,
        0,
        'All ripple elements must be completely unmounted from DOM after animation completion'
      );
    });
  });

  // =========================================================================
  // TC-5: prefers-reduced-motion Accessibility Respect
  // =========================================================================
  describe('5. prefers-reduced-motion Handling', () => {
    test('When prefers-reduced-motion is enabled, ripple wave is suppressed while navigation succeeds', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);

      const bottomNav = page.locator('nav.fixed.bottom-0');
      const inventori = bottomNav.getByRole('link', { name: /Inventori/i });

      // Dispatch pointerdown to test ripple suppression
      await inventori.dispatchEvent('pointerdown', { button: 0 });

      const rippleCount = await inventori.locator('.animate-ripple').count();
      assert.equal(
        rippleCount,
        0,
        'Ripple element creation must be completely skipped when prefers-reduced-motion is active'
      );

      // Perform navigation click and verify smooth routing
      await inventori.click();
      await page.waitForURL('**/inventori', { timeout: 5000 });
      assert.ok(page.url().includes('/inventori'), 'Navigation must still complete successfully');

      // Reset media emulation back to standard
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    });
  });
});
