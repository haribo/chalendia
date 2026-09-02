import { expect, test } from '@playwright/test'

import { reportStep } from '../report-step'

/**
 * The journey an operator takes on an untouched installation.
 *
 * It runs against a database wiped beforehand, because setup happens once —
 * that is the behaviour under test, not an inconvenience to work around.
 */
test.describe('First run', () => {
  test('an operator configures the shop and lands in the back office', async ({ page }) => {
    await reportStep(page, 'Any address leads to setup', async () => {
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/setup$/)
      await expect(page.getByRole('button', { name: /create the shop|créer la boutique/i })).toBeVisible()
    })

    await reportStep(page, 'The shop is described', async () => {
      await page.getByLabel(/^name$|^nom$/i).fill('La Fabrique à Savons')
      await page
        .getByLabel(/legal name|raison sociale/i)
        .fill('SAS La Fabrique — SIRET 512 874 331 00027')
      // Chosen rather than left at its default: a field nobody ever picks is a
      // field nobody tests (#67).
      await page
        .getByLabel(/country of the shop|pays de la boutique/i)
        .selectOption('BE')
    })

    await reportStep(page, 'A bad address and a short password are refused', async () => {
      await page.getByLabel(/email address|adresse e-mail/i).fill('owner@')
      await page.getByLabel(/^password$|^mot de passe$/i).fill('short')
      await page.getByRole('button', { name: /create the shop|créer la boutique/i }).click()

      // Both refusals arrive together, and neither carries words: an address
      // missing its domain and a password too short each show their own
      // problem (#71).
      await expect(page.locator('.message').filter({ visible: true })).toHaveCount(0)

      // The field keeps its own name even while refused, which is what lets
      // this line find it at all.
      await expect(page.getByLabel(/^password$|^mot de passe$/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      await expect(page.getByLabel(/email address|adresse e-mail/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      await expect(page).toHaveURL(/\/setup$/)
    })

    await reportStep(page, 'A long password a dictionary knows is refused too', async () => {
      await page.getByLabel(/email address|adresse e-mail/i).fill('owner@fabrique-savons.fr')
      await page.getByLabel(/^password$|^mot de passe$/i).fill('motdepasse123')
      await page.getByRole('button', { name: /create the shop|créer la boutique/i }).click()

      // Thirteen characters, and the value hides its problem entirely — so
      // this is the one refusal the shop puts words on.
      await expect(
        page.getByText(/too common|trop courant/i).filter({ visible: true }),
      ).toBeVisible()
      await expect(page).toHaveURL(/\/setup$/)
    })

    await reportStep(page, 'Corrected, the shop is created', async () => {
      await page.getByLabel(/email address|adresse e-mail/i).fill('owner@fabrique-savons.fr')
      await page.getByLabel(/^password$|^mot de passe$/i).fill('correct cheval pile agrafe')
      await page.getByRole('button', { name: /create the shop|créer la boutique/i }).click()
    })

    await reportStep(page, 'The operator lands in the back office, signed in', async () => {
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: /dashboard|tableau de bord/i })).toBeVisible()
    })

    await reportStep(page, 'The system status answers', async () => {
      // The dashboard reads it through the typed client, so this also proves
      // the contract chain end to end.
      await expect(page.getByText(/serving|en service/i)).toBeVisible()
      await expect(page.getByText(/reachable|joignable/i)).toBeVisible()
    })
  })

  test('setup refuses to run twice', async ({ page }) => {
    await reportStep(page, 'The setup address says it is over', async () => {
      await page.goto('/setup')

      await expect(page.getByText(/already set up|déjà configurée/i)).toBeVisible()
      await expect(
        page.getByRole('button', { name: /create the shop|créer la boutique/i }),
      ).toHaveCount(0)
    })
  })
})
