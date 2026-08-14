import { test, type Page } from '@playwright/test'

/**
 * A named step, captured.
 *
 * The screenshot is what the reviewer scrolls through, so every step of every
 * journey takes one — not only the ones that fail. The name is what appears
 * under it in the report.
 */
export async function reportStep(page: Page, name: string, body: () => Promise<void>): Promise<void> {
  await test.step(name, async () => {
    await body()
    await test.info().attach(`step: ${name}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
  })
}
