import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import CatalogueView from '@/surfaces/admin/CatalogueView.vue'
import { useShopStore } from '@/stores/shop'
import type { ProductPage, ProductSummary } from '@/shared/api/catalogue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const listProducts = vi.fn()
vi.mock('@/shared/api/catalogue', () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
}))

function product(over: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: 1,
    title: 'Savon de Marseille',
    slug: 'savon-de-marseille',
    state: 'published',
    price: 690,
    ...over,
  }
}

function page(items: ProductSummary[], over: Partial<ProductPage> = {}): ProductPage {
  return { items, page: 1, pageSize: 20, total: items.length, ...over }
}

async function catalogue() {
  const wrapper = mount(CatalogueView, {
    global: { plugins: [i18n], stubs: { RouterLink: true } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  useShopStore().currency = 'EUR'
  listProducts.mockReset()
})

describe('CatalogueView', () => {
  /**
   * One screen, not two: with nothing in it the table is replaced by a
   * sentence, and no empty table teaches the columns of what does not exist
   * (docs/design/catalog.md § 7).
   */
  it('says there is nothing rather than showing an empty table', async () => {
    listProducts.mockResolvedValue({ kind: 'listed', page: page([]) })

    const wrapper = await catalogue()

    expect(wrapper.text()).toContain('No products yet.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows the columns the design fixed, once there are products', async () => {
    listProducts.mockResolvedValue({ kind: 'listed', page: page([product()]) })

    const headers = (await catalogue()).findAll('th').map((cell) => cell.text())

    expect(headers).toEqual(['Product', 'Reference', 'Price', 'State'])
  })

  it('reads a price in the shop currency rather than in minor units', async () => {
    listProducts.mockResolvedValue({ kind: 'listed', page: page([product({ price: 690 })]) })

    expect((await catalogue()).text()).toMatch(/6\.90/)
  })

  it('shows a product with no reference without inventing one', async () => {
    listProducts.mockResolvedValue({
      kind: 'listed',
      page: page([product({ merchantReference: undefined })]),
    })

    expect((await catalogue()).find('td.reference').text()).toBe('—')
  })

  it('names the state in words, not in colour alone', async () => {
    listProducts.mockResolvedValue({
      kind: 'listed',
      page: page([product({ state: 'draft' })]),
    })

    expect((await catalogue()).find('.state').text()).toBe('Draft')
  })

  /**
   * One shape at a time. Rendering the table and the cards together and hiding
   * one in CSS puts every product in the document twice, which is how a search
   * for a title finds two of it.
   */
  it('draws the rows one way, not both', async () => {
    listProducts.mockResolvedValue({
      kind: 'listed',
      page: page([product({ id: 1 }), product({ id: 2, title: 'Savon au miel' })]),
    })

    const wrapper = await catalogue()

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.findAll('.cards li')).toHaveLength(0)
  })

  it('says where the page sits in the whole', async () => {
    listProducts.mockResolvedValue({
      kind: 'listed',
      page: page([product()], { page: 2, pageSize: 20, total: 25 }),
    })

    expect((await catalogue()).find('.paging').text()).toBe('21–21 of 25')
  })

  it('says so when the shop does not answer', async () => {
    listProducts.mockResolvedValue({ kind: 'unreachable' })

    const wrapper = await catalogue()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No products yet.')
  })
})
