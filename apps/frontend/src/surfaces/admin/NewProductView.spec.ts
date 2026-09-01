import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import NewProductView from '@/surfaces/admin/NewProductView.vue'
import { useShopStore } from '@/stores/shop'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const createProduct = vi.fn()
vi.mock('@/shared/api/catalogue', () => ({
  createProduct: (...args: unknown[]) => createProduct(...args),
}))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

function form() {
  return mount(NewProductView, { global: { plugins: [i18n] } })
}

async function fill(wrapper: ReturnType<typeof form>, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    await wrapper.find(`#${labelledId(wrapper, label)}`).setValue(value)
  }
}

/** Finds the control a label names, the way a person does. */
function labelledId(wrapper: ReturnType<typeof form>, text: string): string {
  const label = wrapper.findAll('label').find((l) => l.text().startsWith(text))
  return label?.attributes('for') ?? ''
}

beforeEach(() => {
  setActivePinia(createPinia())
  useShopStore().currency = 'EUR'
  createProduct.mockReset()
  push.mockReset()
})

describe('NewProductView', () => {
  it('sends the amount in minor units, whichever separator was typed', async () => {
    createProduct.mockResolvedValue({ kind: 'listed', page: { items: [], page: 1, pageSize: 20, total: 0 } })
    const wrapper = form()

    await fill(wrapper, { Name: 'Savon de Marseille', Price: '6,90' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ price: 690 }))
  })

  it('creates a draft unless publishing was asked for', async () => {
    createProduct.mockResolvedValue({ kind: 'listed', page: { items: [], page: 1, pageSize: 20, total: 0 } })
    const wrapper = form()

    await fill(wrapper, { Name: 'Savon', Price: '5' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ state: 'draft' }))

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createProduct).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'published' }))
  })

  it('leaves out what was not filled in, rather than sending empty strings', async () => {
    createProduct.mockResolvedValue({ kind: 'listed', page: { items: [], page: 1, pageSize: 20, total: 0 } })
    const wrapper = form()

    await fill(wrapper, { Name: 'Savon', Price: '5' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined, merchantReference: undefined }),
    )
  })

  it('lands on the list, where the new product leads', async () => {
    createProduct.mockResolvedValue({ kind: 'listed', page: { items: [], page: 1, pageSize: 20, total: 0 } })
    const wrapper = form()

    await fill(wrapper, { Name: 'Savon', Price: '5' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/admin/catalogue')
  })

  /** The words are the API's; the form marks the field and invents nothing. */
  it('marks every field the shop refused', async () => {
    createProduct.mockResolvedValue({
      kind: 'refused',
      params: [{ name: 'title' }, { name: 'price', reason: 'must be positive' }],
    })
    const wrapper = form()

    await fill(wrapper, { Name: ' ', Price: '5' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('must be positive')
  })

  /**
   * An unreadable amount cannot go in the request at all — the contract
   * carries an integer — so the field is marked here, without words, and the
   * shop is not asked. See #56.
   */
  it('marks an unreadable price without asking the shop', async () => {
    const wrapper = form()

    await fill(wrapper, { Name: 'Savon', Price: 'gratuit' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createProduct).not.toHaveBeenCalled()
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(1)
  })

  it('says so when the shop does not answer, and stays on the form', async () => {
    createProduct.mockResolvedValue({ kind: 'unreachable' })
    const wrapper = form()

    await fill(wrapper, { Name: 'Savon', Price: '5' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  /** A refused field shows its own problem; a line repeating it says nothing. */
  it('carries no summary line above the fields', async () => {
    createProduct.mockResolvedValue({ kind: 'refused', params: [{ name: 'title' }] })
    const wrapper = form()

    await fill(wrapper, { Name: ' ', Price: '5' })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
