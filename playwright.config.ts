import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3005', storageState: process.env.PLAYWRIGHT_STORAGE_STATE || undefined, trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: 'npm run start --workspace=@recoverflow/web -- -p 3005', url: 'http://127.0.0.1:3005', reuseExistingServer: false, timeout: 120000, env: { RECOVERFLOW_RUNTIME_MODE: 'DEMO', PORT: '3005' } },
});
