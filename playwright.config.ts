import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e config (T263). The suite is one command from a cold
 * checkout: `webServer` below starts `pnpm start` itself, so `pnpm test:e2e`
 * never assumes a server is already running.
 *
 * No live `wedding-api` is required or contacted — every spec stubs the
 * network at the Playwright layer (`e2e/support/api-mocks.ts`).
 *
 * Browser targets are CLAUDE.md hard rule 4's own list: iOS Safari on iPhone
 * SE / 12 / 14 (WebKit, the only engine that matches real iOS Safari) and
 * current-major Chrome Android (Pixel 7, Chromium — Playwright has no real
 * Android Chrome binary; Chromium is the engine Chrome for Android itself
 * ships, so this is the closest available target). All four are mobile
 * viewports, matching the app's mobile-first design.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'iPhone SE (iOS Safari)', use: { ...devices['iPhone SE'] } },
    { name: 'iPhone 12 (iOS Safari)', use: { ...devices['iPhone 12'] } },
    { name: 'iPhone 14 (iOS Safari)', use: { ...devices['iPhone 14'] } },
    { name: 'Pixel 7 (Chrome Android)', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
