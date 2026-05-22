import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://localhost:4000';
const APP_URL = 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,

  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'node dist/server.js',
      cwd: '../backend',
      url: `${API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://admin:changeme@127.0.0.1:27017/e2e_test?authSource=admin',
        JWT_ACCESS_SECRET: 'e2e-access-secret',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret',
        LLM_PROVIDER: 'fake',
        CORS_ALLOWED_ORIGINS: APP_URL,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'npm run dev',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
      },
    },
  ],
});
