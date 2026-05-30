import { defineConfig, devices } from '@playwright/test';

/**
 * playwright.config.ts — FintekPro E2E test configuration
 *
 * @purpose  Configure Playwright to run browser-level integration tests
 *           against the local dev server (port 5000).
 * @outputs  Test reports under playwright-report/
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,  // Financial tests must not race on shared DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Meaningful timeouts for financial platform (some pages are data-heavy)
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for mobile regression:
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Only spin up the server in CI; developers run `npm run dev` themselves.
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5000',
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  // },
});
