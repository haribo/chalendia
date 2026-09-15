import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { reportStep } from '../report-step'

/**
 * Adding photographs to a product, ordering them, and finding one refused (#75).
 *
 * This journey carries what no unit test here can: jsdom has neither a canvas
 * nor `createImageBitmap`, so that a photograph is uprighted, flattened and
 * converted is provable only against a real browser
 * (`docs/delivery-workflow.md` § 4).
 */
const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/sign-in')
  await page.getByLabel(/email address|adresse e-mail/i).fill('owner@fabrique-savons.fr')
  await page.getByLabel(/^password$|^mot de passe$/i).fill('correct cheval pile agrafe')
  await page.getByRole('button', { name: /sign in|se connecter/i }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test.describe('A product’s photographs', () => {
  test('a merchant adds photographs, orders them, and is told what was refused', async ({ page }) => {
    await signIn(page)

    await reportStep(page, 'The catalogue opens a product', async () => {
      // A row leads to the product it names. The photographs are a section of
      // that product's screen, never a screen of their own: a catalogue holds
      // products (`docs/design/catalog.md` § 7).
      await page.goto('/admin/catalogue')
      await page.getByRole('link', { name: /Savon de Marseille/ }).click()

      // The product is the title, so the screen says which product this is.
      await expect(
        page.getByRole('heading', { name: /Savon de Marseille/, level: 1 }),
      ).toBeVisible()
      await expect(page.getByRole('heading', { name: /photographs|photographies/i })).toBeVisible()
      // Nothing yet, and the limits are said once where they are useful.
      await expect(page.getByText(/800 px/)).toBeVisible()
    })

    await reportStep(page, 'A photograph on its side arrives upright', async () => {
      await page.locator('input[type="file"]').first().setInputFiles(fixture('oriented-landscape.jpg'))

      const first = page.locator('img').first()
      await expect(first).toBeVisible()

      // The file is 1000 x 800 with EXIF orientation 6, and 800 x 1000 is what
      // the shop stored — so what reached it was upright.
      //
      // What this does *not* prove is that our option did it: Chromium uprights
      // regardless, measured. The assertion is still worth keeping, because it
      // is the promise the design makes to a merchant, and it would catch the
      // day an engine stops keeping it.
      const stored = await page.evaluate(async () => {
        const answer = await fetch('/api/products/1/images', { credentials: 'include' })
        return (await answer.json()) as { width: number; height: number }[]
      })
      expect(stored[0].width).toBe(800)
      expect(stored[0].height).toBe(1000)
    })

    await reportStep(page, 'A cut-out on transparency becomes a JPEG', async () => {
      await page.locator('input[type="file"]').first().setInputFiles(fixture('cut-out.png'))

      await expect(page.locator('img')).toHaveCount(2)
      // Accepted at all is the proof: the shop reads the bytes and refuses
      // anything that is not a JPEG, whatever the file was named.
      await expect(page.getByText(/n’est pas un JPEG|not a JPEG/i)).toHaveCount(0)
    })

    await reportStep(page, 'A photograph without a description is counted, not refused', async () => {
      await expect(
        page.getByText(/attendent encore|waiting for their alternative text/i),
      ).toBeVisible()

      const field = page.getByLabel(/texte alternatif|alternative text/i).first()
      await field.fill('Savon au miel sur un linge écru')
      await field.blur()

      // One left, so the sentence changes rather than disappearing.
      await expect(page.getByText(/attend encore|waiting for its alternative text/i)).toBeVisible()
    })

    await reportStep(page, 'The second photograph becomes the first', async () => {
      const shown = () => page.locator('img').evaluateAll((images) =>
        images.map((image) => (image as HTMLImageElement).src),
      )
      const before = await shown()
      expect(await page.locator('.rank').allTextContents()).toEqual(['1', '2'])

      await page.getByRole('button', { name: /reculer|move this photograph back/i }).nth(1).click()

      // What is on screen, not what the shop holds: an interface that kept its
      // own guess would still pass an assertion made against the API, and the
      // merchant would be looking at an order nobody stored.
      await expect
        .poll(shown, { message: 'the two photographs swapped places on screen' })
        .toEqual([before[1], before[0]])
      expect(await page.locator('.rank').allTextContents()).toEqual(['1', '2'])
    })

    await reportStep(page, 'A photograph smaller than the shop serves is named and refused', async () => {
      await page.locator('input[type="file"]').first().setInputFiles(fixture('too-small.jpg'))

      await expect(page.getByText(/too-small\.jpg/)).toBeVisible()
      await expect(page.getByText(/640 px/)).toBeVisible()
      // Refused before it left, so the list is unchanged.
      await expect(page.locator('img')).toHaveCount(2)
    })

    await reportStep(page, 'Removing one asks first', async () => {
      await page.getByRole('button', { name: /retirer cette photographie|remove this photograph/i }).first().click()

      await expect(page.getByText(/Retirer cette photographie \?|Remove this photograph\?/)).toBeVisible()
      await page.getByRole('button', { name: /^annuler$|^cancel$/i }).click()
      await expect(page.locator('img')).toHaveCount(2)

      await page.getByRole('button', { name: /retirer cette photographie|remove this photograph/i }).first().click()
      await page.getByRole('button', { name: /^retirer$|^remove$/i }).click()

      await expect(page.locator('img')).toHaveCount(1)
    })
  })
})
