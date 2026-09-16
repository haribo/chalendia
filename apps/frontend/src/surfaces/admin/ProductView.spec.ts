import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import fr from '@/i18n/locales/fr.json'
import type { ProductSummary } from '@/shared/api/catalogue'
import ProductView from '@/surfaces/admin/ProductView.vue'
import { useShopStore } from '@/stores/shop'

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } })

const readProduct = vi.fn()
vi.mock('@/shared/api/catalogue', () => ({
  readProduct: (...a: unknown[]) => readProduct(...a),
}))

/**
 * The photographs are a section of this screen and have their own file of
 * tests. Stubbed here so what is under test is the product: its facts, its
 * trail, and what it does when the shop has no such product.
 */
vi.mock('@/surfaces/admin/ProductPhotographs.vue', () => ({
  default: { name: 'ProductPhotographs', props: ['productId'], template: '<div class="photographs" />' },
}))

function product(over: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: 3,
    title: 'Savon au miel de châtaignier',
    slug: 'savon-au-miel-de-chataignier',
    state: 'published',
    price: 690,
    merchantReference: 'SAV-MIEL-100',
    vatBasisPoints: 2000,
    ...over,
  }
}

async function screen(over: Partial<ProductSummary> = {}) {
  readProduct.mockResolvedValue({ kind: 'product', product: product(over) })
  const wrapper = mount(ProductView, {
    props: { id: '3' },
    global: { plugins: [i18n], stubs: { NavLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  const shop = useShopStore()
  shop.currency = 'EUR'
  shop.vatEnabled = true
  readProduct.mockReset()
})

describe('a product’s own screen', () => {
  it('is titled by the product, not by one of its parts', async () => {
    // The defect this screen exists for: a page called "Photographs" under a
    // menu called "Catalogue" says the catalogue holds photographs.
    const wrapper = await screen()

    expect(readProduct).toHaveBeenCalledWith(3)
    expect(wrapper.get('h1').text()).toBe('Savon au miel de châtaignier')
  })

  it('leads back to the catalogue, and names nothing else', async () => {
    // The product is the screen's title; repeating it in the trail would say it
    // twice.
    const wrapper = await screen()

    expect(wrapper.get('.crumb').text()).toBe('Catalogue')
  })

  it('reads the facts the list carried in columns', async () => {
    const text = (await screen()).text()

    expect(text).toContain('SAV-MIEL-100')
    expect(text).toMatch(/6,90/)
    expect(text).toContain('20')
    expect(text).toContain('Publié')
  })

  it('shows a dash for a reference nobody typed', async () => {
    const wrapper = await screen({ merchantReference: undefined })

    expect(wrapper.get('.code').text()).toBe('—')
  })

  it('says nothing about tax when the shop charges none', async () => {
    // A shop installed without VAT has no rate to show, and a column of dashes
    // would be a question nobody asked.
    setActivePinia(createPinia())
    const shop = useShopStore()
    shop.currency = 'EUR'
    shop.vatEnabled = false

    const wrapper = await screen()

    expect(wrapper.text()).not.toContain('TVA')
  })

  it('tells draft and retired apart by their icon, not by their tone', async () => {
    // Both are neutral and mean opposite things — still being written, versus
    // taken out of sight.
    const drafted = await screen({ state: 'draft' })
    const retired = await screen({ state: 'retired' })

    const iconOf = (w: typeof drafted) => w.findComponent({ name: 'Pill' }).props('icon')
    expect(iconOf(drafted)).toBeDefined()
    expect(iconOf(retired)).toBeDefined()
    expect(iconOf(drafted)).not.toBe(iconOf(retired))
  })

  it('holds the photographs as a section, and hands it the product', async () => {
    const section = (await screen()).findComponent({ name: 'ProductPhotographs' })

    expect(section.exists()).toBe(true)
    expect(section.props('productId')).toBe(3)
  })

  it('says so when the shop holds no such product, and shows no facts', async () => {
    readProduct.mockResolvedValue({ kind: 'refused' })
    const wrapper = mount(ProductView, {
      props: { id: '404' },
      global: { plugins: [i18n], stubs: { NavLink: { template: '<a><slot /></a>' } } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('n’existe pas')
    // An empty facts list beside the message would read as a product with
    // nothing in it rather than as no product at all.
    expect(wrapper.find('.facts').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ProductPhotographs' }).exists()).toBe(false)
  })
})
