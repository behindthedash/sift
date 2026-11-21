import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.SIFT_DEMO_URL || 'http://localhost:3000' },
  webServer: process.env.SIFT_DEMO_URL ? undefined : {
    command: 'npm run demo', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI,
  },
});
