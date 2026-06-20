// playwright.config.js — end-to-end smoke harness for the PDF audit report.
//
// Requires Playwright browsers to be installed locally before tests will run:
//
//   npx playwright install --with-deps chromium
//
// Or in CI:
//
//   npx playwright install chromium
//
// The default test suite targets the jsdom-rendered unit tests, so the e2e
// suite is opt-in via `npm run test:e2e`. We keep one Chromium project for
// now; expand if/when we add more browser coverage.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    headless: true,
  },
  // Auto-start `vite preview` so the smoke is self-contained. Set
  // E2E_BASE_URL to use an already-running server (e.g. in CI with
  // shared preview service).
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
