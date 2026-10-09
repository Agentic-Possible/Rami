import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/qa',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /ipad\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /ipad\.spec/ },
    // The spec launches its own persistent iPad context; see its header.
    { name: 'ipad', testMatch: /ipad\.spec/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    env: { OPENROUTER_API_KEY: '' },
  },
})
