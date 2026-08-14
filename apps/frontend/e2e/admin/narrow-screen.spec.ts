import { expect, test } from '@playwright/test'

import { reportStep } from '../report-step'

/**
 * The back office on a phone — the regression guard for #41, where the bar
 * overflowed and the shop link covered the sign-out button, making it
 * impossible to tap.
 *
 * The drawer only exists below 768 px, so this journey qualifies itself: it
 * runs in the mobile variant and skips in the desktop ones rather than
 * asserting something that is deliberately absent there.
 */
test.describe('The back office on a narrow screen', () => {
  test('its sections and account actions live in a drawer', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel(/email address|adresse e-mail/i).fill('owner@fabrique-savons.fr')
    await page.getByLabel(/^password$|^mot de passe$/i).fill('correct cheval pile agrafe')
    await page.getByRole('button', { name: /sign in|se connecter/i }).click()
    await expect(page).toHaveURL(/\/admin$/)

    const menu = page.getByRole('button', { name: /sections and account|sections et compte/i })
    test.skip(!(await menu.isVisible()), 'The drawer only exists below 768 px.')

    await reportStep(page, 'The bar offers one button instead of five actions', async () => {
      // The whole point of #41: what used to overflow now fits, and the page
      // no longer drags sideways.
      const [page_, viewport] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ])
      expect(page_).toBe(viewport)

      await expect(page.getByRole('button', { name: /sign out|se déconnecter/i })).toBeHidden()
    })

    await reportStep(page, 'The drawer holds the sections and the account', async () => {
      await menu.click()

      const drawer = page.getByRole('dialog')
      await expect(drawer.getByRole('link', { name: /catalogue/i })).toBeVisible()
      await expect(drawer.getByRole('link', { name: /settings|réglages/i })).toBeVisible()
      await expect(drawer.getByText('owner@fabrique-savons.fr')).toBeVisible()
      await expect(drawer.getByRole('button', { name: /sign out|se déconnecter/i })).toBeVisible()
    })

    await reportStep(page, 'Escape closes it', async () => {
      await page.keyboard.press('Escape')

      await expect(page.getByRole('dialog')).toBeHidden()
    })

    await reportStep(page, 'Choosing a section closes it too', async () => {
      await menu.click()
      await page.getByRole('dialog').getByRole('link', { name: /orders|commandes/i }).click()

      await expect(page.getByRole('dialog')).toBeHidden()
    })

    await reportStep(page, 'And signing out from it returns to the shop', async () => {
      await menu.click()
      await page.getByRole('dialog').getByRole('button', { name: /sign out|se déconnecter/i }).click()

      await expect(page).toHaveURL(/\/$/)
    })
  })
})
