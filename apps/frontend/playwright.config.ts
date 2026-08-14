import { defineConfig, devices } from '@playwright/test'

/**
 * The suite runs against the real stack — the API, its database, and the built
 * interface — because a journey mocked at the boundary proves the mock.
 *
 * Video and screenshots are kept for **every** case, passing ones included:
 * they are not failure diagnostics here, they are what the reviewer looks at.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './tmp/e2e-artifacts',
  fullyParallel: false,
  // Journeys share one shop, and setup happens once: running them at the same
  // time would have them fight over the same installation.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: './tmp/e2e-report/report.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5183',
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
