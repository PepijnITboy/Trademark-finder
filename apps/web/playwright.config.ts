import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke-test config for `apps/web`.
 *
 * By default this only exercises the static UI shell against the Vite dev
 * server (`webServer` below starts it automatically) — no backend API is
 * required for these checks to pass, since every page renders its heading
 * and navigation synchronously and only the *data* (tables, KPIs) depends
 * on `@merkwacht/api`. To validate full data-driven flows, start
 * `pnpm dev:api` (and the local Supabase stack) before running
 * `pnpm test:e2e`, see `README.md`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'VITE_API_URL=http://localhost:3001 pnpm exec vite --port 8000 --strictPort',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
