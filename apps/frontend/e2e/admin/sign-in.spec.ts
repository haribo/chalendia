import { expect, test, type Page } from '@playwright/test'

import { reportStep } from '../report-step'

/** Present only below 768 px, where it opens the drawer holding the account. */
const menuButton = (page: Page) =>
  page.getByRole('button', { name: /sections and account|sections et compte/i })

/**
 * Reaching the back office without a session, and leaving it.
 *
 * Runs after the first-run journey, which is declared as a dependency in the
 * Playwright config: the shop this signs in to is the one that journey created.
 */
test.describe('Signing in', () => {

  test('a staff member signs in and lands on the page they asked for', async ({ page }) => {
    await reportStep(page, 'An administration address asks who is calling', async () => {
      await page.goto('/admin')

      await expect(page).toHaveURL(/\/sign-in\?next=/)
      await expect(page.getByRole('button', { name: /sign in|se connecter/i })).toBeVisible()
    })

    await reportStep(page, 'A wrong pair is refused without saying which half', async () => {
      await page.getByLabel(/email address|adresse e-mail/i).fill('owner@fabrique-savons.fr')
      await page.getByLabel(/^password$|^mot de passe$/i).fill('not the right one')
      await page.getByRole('button', { name: /sign in|se connecter/i }).click()

      const refusal = page.getByRole('alert')
      await expect(refusal).toBeVisible()
      await expect(refusal).toContainText(/do not match|ne correspondent pas/i)
      // Neither field is marked: doing so would say which half is wrong.
      await expect(page.getByLabel(/email address|adresse e-mail/i)).not.toHaveAttribute(
        'aria-invalid',
        'true',
      )
    })

    await reportStep(page, 'The right pair opens the back office', async () => {
      await page.getByLabel(/^password$|^mot de passe$/i).fill('correct cheval pile agrafe')
      await page.getByRole('button', { name: /sign in|se connecter/i }).click()

      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: /dashboard|tableau de bord/i })).toBeVisible()

      // Who is signed in shows in the bar on a wide screen and in the drawer
      // on a narrow one (#41). Either way the interface names who it let in.
      if (await menuButton(page).isVisible()) {
        await menuButton(page).click()
        await expect(page.getByRole('dialog').getByText('owner@fabrique-savons.fr')).toBeVisible()
        await page.keyboard.press('Escape')
      } else {
        await expect(page.getByText('owner@fabrique-savons.fr')).toBeVisible()
      }
    })

    await reportStep(page, 'Signing out returns to the shop', async () => {
      // Below 768 px the account actions live in the drawer (#41); above it
      // they are in the bar. The journey is the same either way.
      if (await menuButton(page).isVisible()) await menuButton(page).click()

      await page.getByRole('button', { name: /sign out|se déconnecter/i }).click()

      await expect(page).toHaveURL(/\/$/)
    })

    await reportStep(page, 'And the session is over for good', async () => {
      await page.goto('/admin')

      // The cookie was revoked server-side, so the door asks again.
      await expect(page).toHaveURL(/\/sign-in/)
    })
  })
})
