import { expect, test } from '@playwright/test'

import { reportStep } from '../report-step'

/**
 * Describing a product and finding it again — the smallest catalogue a
 * merchant can actually use (#46).
 *
 * Runs on the shop the first-run journey created, and leaves a product behind:
 * the later journeys do not look at the catalogue.
 */
test.describe('The catalogue', () => {
  test('a merchant describes a product and finds it in the list', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel(/email address|adresse e-mail/i).fill('owner@fabrique-savons.fr')
    await page.getByLabel(/^password$|^mot de passe$/i).fill('correct cheval pile agrafe')
    await page.getByRole('button', { name: /sign in|se connecter/i }).click()
    await expect(page).toHaveURL(/\/admin$/)

    await reportStep(page, 'A new shop sells nothing, and says so', async () => {
      await page.goto('/admin/catalogue')

      await expect(page.getByText(/no products yet|aucun produit/i)).toBeVisible()
      // Not an empty table: the sentence stands where the table would be.
      await expect(page.locator('table')).toHaveCount(0)
    })

    await reportStep(page, 'A price nobody can read is refused on the spot', async () => {
      await page.getByRole('button', { name: /add a product|ajouter un produit/i }).click()
      await expect(page).toHaveURL(/\/catalogue\/new$/)

      await page.getByLabel(/^price$|^prix$/i).fill('gratuit')
      await page.getByRole('button', { name: /create the product|créer le produit/i }).click()

      // The value shows the problem, so the field carries no words (#56).
      await expect(page.getByLabel(/^price$|^prix$/i)).toHaveAttribute('aria-invalid', 'true')
    })

    await reportStep(page, 'The shop refuses what it is given, all at once', async () => {
      await page.getByLabel(/^price$|^prix$/i).fill('6,90')
      await page.getByRole('button', { name: /create the product|créer le produit/i }).click()

      // A blank title is the shop's refusal, not the form's.
      await expect(page.getByLabel(/^name$|^nom$/i)).toHaveAttribute('aria-invalid', 'true')
      await expect(page).toHaveURL(/\/catalogue\/new$/)
    })

    await reportStep(page, 'Described and published, the product is created', async () => {
      await page.getByLabel(/^name$|^nom$/i).fill("Savon de Marseille à l'huile d'olive")
      await page.getByLabel(/^description$/i).fill("Cube de 300 g, à l'huile d'olive.")
      await page.getByLabel(/^reference$|^référence$/i).fill('SAV-300')
      await page.getByLabel(/publish it now|le publier maintenant/i).check()
      await page.getByRole('button', { name: /create the product|créer le produit/i }).click()

      await expect(page).toHaveURL(/\/admin\/catalogue$/)
    })

    await reportStep(page, 'And it is there, with its price and its state', async () => {
      await expect(page.getByText("Savon de Marseille à l'huile d'olive")).toBeVisible()
      // Read in the shop's currency, never in the minor units it is held in.
      await expect(page.getByText(/6[.,]90/)).toBeVisible()
      await expect(page.getByText(/published|publié/i)).toBeVisible()
      await expect(page.getByText('SAV-300')).toBeVisible()
    })
  })
})
