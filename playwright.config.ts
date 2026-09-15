import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
const e2eURL = 'http://127.0.0.1:3100'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  // The suite shares one database and intentionally verifies mutations in the
  // Payload admin, so parallel workers would make the run non-deterministic.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: e2eURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath
          ? { launchOptions: { executablePath } }
          : { channel: 'chromium' as const }),
      },
    },
  ],
  webServer: {
    command: 'pnpm start --hostname 127.0.0.1 --port 3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Health-check the lightweight API endpoint instead of the homepage, so
    // readiness is confirmed without triggering a heavy Payload page query on
    // the "first hit" (which can hang and make the boot check flaky).
    url: 'http://127.0.0.1:3100/api/health',
  },
})
