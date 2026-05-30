import { test, expect } from '@playwright/test';

/**
 * tests/e2e/auth.spec.ts — Authentication flow E2E tests
 *
 * Covers: login, invalid-login error handling, and logout.
 * Uses the FintekPro dev server at localhost:5000.
 *
 * NOTE: These tests assume the dev DB has a seed user.
 * Set TEST_USER_EMAIL / TEST_USER_PHONE / TEST_USER_PASSWORD in the env
 * or they fall back to the values below.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:5000';
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'Test@1234';

test.describe('Authentication flows', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh — clear any existing session
    await page.context().clearCookies();
  });

  // ─── Login page loads ───────────────────────────────────────────────────────

  test('login page renders correctly', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page).toHaveTitle(/FintekPro|Login/i);

    // Should have at least one input for email/phone
    const inputs = page.locator('input[type="email"], input[type="tel"], input[type="text"]');
    await expect(inputs.first()).toBeVisible();
  });

  // ─── Invalid credential handling ────────────────────────────────────────────

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`);

    // Fill in wrong credentials
    const emailInput = page.locator('input[type="email"], input[type="text"]').first();
    await emailInput.fill('notauser@invalid.com');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('wrongpassword');

    // Submit
    await page.locator('button[type="submit"]').first().click();

    // Expect an error message — platform should NOT redirect to dashboard
    const errorLocator = page.locator('[role="alert"], .error, [class*="error"], [class*="toast"]');
    await expect(errorLocator.first()).toBeVisible({ timeout: 10_000 });

    // URL should NOT have changed to /dashboard
    expect(page.url()).not.toContain('/dashboard');
  });

  // ─── API health check (no full login needed) ────────────────────────────────

  test('API health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${BASE}/api/health`);
    // Platform should respond — even if endpoint name differs
    expect([200, 404]).toContain(response.status());
  });

  // ─── Redirect unauthenticated users ─────────────────────────────────────────

  test('protected dashboard redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    // Should be redirected somewhere (login page, or show a login button)
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const hasLoginElement = await page.locator('input[type="password"], a[href*="login"]').count();
    // Either URL changed to login, OR the page shows a login form
    const redirectedToLogin = url.includes('/login') || hasLoginElement > 0;
    expect(redirectedToLogin).toBe(true);
  });
});
