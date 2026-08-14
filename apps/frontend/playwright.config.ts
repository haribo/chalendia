import { defineConfig, devices } from '@playwright/test'

/**
 * The suite runs against the real stack — the API, its database, and the built
 * interface — because a journey mocked at the boundary proves the mock.
 *
 * Video and screenshots are kept for **every** case, passing ones included:
 * they are not failure diagnostics here, they are what the reviewer looks at.
 *
 * One run covers one variant. The journeys are replayed for each of them rather
 * than re-rendered, because a layout that breaks a tap target is invisible to a
 * second screenshot of the same run. The shop is installed once and only once,
 * so the loop lives in the justfile, which wipes the database between variants.
 */
const VARIANTS = {
  'desktop-light': { ...devices['Desktop Chrome'], colorScheme: 'light' },
  'desktop-dark': { ...devices['Desktop Chrome'], colorScheme: 'dark' },
  // A phone viewport with touch: taps, not clicks, and the layout the visitor
  // most often gets. The interface follows prefers-color-scheme, which is what
  // colorScheme emulates, so the theme needs no store poking.
  'mobile-light': { ...devices['Pixel 7'], colorScheme: 'light' },
} as const

type Variant = keyof typeof VARIANTS

const name = (process.env.E2E_VARIANT ?? 'desktop-light') as Variant
const variant = VARIANTS[name]

if (!variant) {
  throw new Error(`Unknown E2E_VARIANT "${name}" — expected one of ${Object.keys(VARIANTS).join(', ')}.`)
}

export default defineConfig({
  testDir: './e2e',
  // One directory per variant: Playwright empties the output directory when it
  // starts, and the previous variant's videos are still needed by the report.
  outputDir: `./tmp/e2e-artifacts/${name}`,
  fullyParallel: false,
  // Journeys share one shop, and setup happens once: running them at the same
  // time would have them fight over the same installation.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ['list'],
    // The file name carries the variant — the report generator merges every
    // report-*.json it finds into one case per journey.
    ['json', { outputFile: `./tmp/e2e-report/report-${name}.json` }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5183',
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  // The order is the product's, not a convenience: nobody signs in to a shop
  // that does not exist yet, and the first-run journey needs an untouched
  // installation to be about anything.
  projects: [
    {
      name: 'first run',
      testMatch: /setup\/.*\.spec\.ts/,
      use: variant,
    },
    {
      name: 'the shop once it exists',
      testIgnore: /setup\/.*\.spec\.ts/,
      dependencies: ['first run'],
      use: variant,
    },
  ],
})
