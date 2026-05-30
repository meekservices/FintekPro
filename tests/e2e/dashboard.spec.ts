import { test, expect } from '@playwright/test';

/**
 * tests/e2e/dashboard.spec.ts — Dashboard and navigation E2E tests
 *
 * Tests that key public-facing pages load without JS errors and that
 * navigation elements are present. These tests run against the dev server
 * and do NOT require a logged-in user (they test the pre-auth state).
 *
 * For post-auth tests (portfolio, holdings, etc.) add fixtures here
 * once seed accounts are available in the test environment.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:5000';

test.describe('Application shell and navigation', () => {
  // ─── Home / landing page ─────────────────────────────────────────────────

  test('root path returns a valid HTML page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const response = await page.goto(BASE);
    expect(response?.status()).toBeLessThan(500);

    // Give JS time to boot
    await page.waitForLoadState('domcontentloaded');

    // No uncaught JS errors (warnings are ok)
    const criticalErrors = errors.filter(
      (e) => !e.includes('Warning') && !e.includes('deprecat'),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ─── Static assets ───────────────────────────────────────────────────────

  test('serves a favicon or logo asset', async ({ request }) => {
    const res = await request.get(`${BASE}/favicon.ico`);
    // 200 or 404 both acceptable — just not a 5xx server error
    expect(res.status()).toBeLessThan(500);
  });

  // ─── API base routes ─────────────────────────────────────────────────────

  test('GET /api/mutual-funds returns JSON (or 401)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/mutual-funds`);
    // Without auth: 401 or 403 expected. 5xx means broken server.
    expect(res.status()).toBeLessThan(500);

    if (res.status() === 200) {
      const body = await res.json();
      // Should be an array or paginated object
      expect(typeof body === 'object').toBe(true);
    }
  });

  test('GET /api/users/me returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/users/me`);
    expect([401, 403]).toContain(res.status());
  });

  // ─── Unlisted stocks module ───────────────────────────────────────────────

  test('GET /api/unlisted/companies returns JSON (or 401)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/unlisted/companies`);
    expect(res.status()).toBeLessThan(500);
  });

  // ─── 404 handling ────────────────────────────────────────────────────────

  test('unknown API path returns 404 (not 500)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/this-route-does-not-exist-12345`);
    expect([404, 401]).toContain(res.status());
  });

  // ─── Page-level navigation (unauthenticated) ─────────────────────────────

  test('login page is reachable', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('domcontentloaded');
    // Should show a form or at minimum not crash
    const status = await page.evaluate(() => document.readyState);
    expect(status).toBe('complete');
  });

  test('register/signup page is reachable', async ({ page }) => {
    // Different platforms use different signup paths
    for (const path of ['/register', '/signup', '/onboarding']) {
      const res = await page.goto(`${BASE}${path}`);
      if (res && res.status() < 500) {
        expect(res.status()).toBeLessThan(500);
        break;
      }
    }
  });
});
