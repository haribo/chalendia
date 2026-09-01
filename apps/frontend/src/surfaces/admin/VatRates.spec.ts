import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import VatRates from '@/surfaces/admin/VatRates.vue'
import type { VatRate } from '@/shared/api/tax'

const listRates = vi.fn()
const addRate = vi.fn()
const removeRate = vi.fn()
const makeDefault = vi.fn()

vi.mock('@/shared/api/tax', () => ({
  listRates: () => listRates(),
  addRate: (...args: unknown[]) => addRate(...args),
  removeRate: (...args: unknown[]) => removeRate(...args),
  makeDefault: (...args: unknown[]) => makeDefault(...args),
}))

function rate(over: Partial<VatRate> = {}): VatRate {
  return { id: 1, name: 'Standard', basisPoints: 2000, isDefault: true, ...over }
}

async function rates(locale = 'en') {
  const i18n = createI18n({ legacy: false, locale, messages: { en, fr } })
  const wrapper = mount(VatRates, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  for (const stub of [listRates, addRate, removeRate, makeDefault]) stub.mockReset()
  listRates.mockResolvedValue({ kind: 'listed', rates: [] })
})

describe('VatRates', () => {
  it('says there is no rate rather than showing an empty table', async () => {
    const wrapper = await rates()

    expect(wrapper.text()).toContain('No VAT rate yet.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('reads basis points as a percentage', async () => {
    listRates.mockResolvedValue({
      kind: 'listed',
      rates: [rate(), rate({ id: 2, name: 'Réduit', basisPoints: 550, isDefault: false })],
    })

    const percentages = (await rates()).findAll('td.percent').map((cell) => cell.text())

    expect(percentages[0]).toMatch(/20\s*%/)
    expect(percentages[1]).toMatch(/5\.5\s*%/)
  })

  it('marks one default, and offers to move it to the others', async () => {
    listRates.mockResolvedValue({
      kind: 'listed',
      rates: [rate(), rate({ id: 2, name: 'Réduit', isDefault: false })],
    })

    const wrapper = await rates()

    expect(wrapper.findAll('.default')).toHaveLength(1)
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Make default')).toHaveLength(1)
  })

  /** Typed as a percentage, held in basis points, like euros and cents. */
  it('sends a percentage as basis points', async () => {
    addRate.mockResolvedValue({ kind: 'listed', rates: [rate()] })
    const wrapper = await rates()

    await wrapper.findAll('input')[0].setValue('5,5')
    await wrapper.findAll('input')[1].setValue('5,5')
    await wrapper.find('input').setValue('Réduit')
    await wrapper.findAll('button').at(-1)!.trigger('click')
    await flushPromises()

    expect(addRate).toHaveBeenCalledWith({ name: 'Réduit', basisPoints: 550 })
  })

  it('marks every field the shop refused', async () => {
    addRate.mockResolvedValue({
      kind: 'refused',
      params: [{ name: 'name' }, { name: 'basisPoints' }],
    })
    const wrapper = await rates()

    await wrapper.findAll('button').at(-1)!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(2)
  })

  /**
   * The shop sends a count; the sentence is written here. A server writing
   * prose is a server writing "1 products", in a language it cannot know.
   */
  it('writes the refusal in the reader language, singular included', async () => {
    listRates.mockResolvedValue({ kind: 'listed', rates: [rate()] })
    removeRate.mockResolvedValue({ kind: 'in-use', products: 1 })

    const english = await rates('en')
    await english.findAll('button').filter((b) => b.attributes('aria-label'))[0].trigger('click')
    await flushPromises()
    expect(english.find('.in-use').text()).toContain('One product carries this rate')

    const french = await rates('fr')
    await french.findAll('button').filter((b) => b.attributes('aria-label'))[0].trigger('click')
    await flushPromises()
    expect(french.find('.in-use').text()).toContain('Un produit utilise ce taux')
  })

  it('counts in the plural when several carry it', async () => {
    listRates.mockResolvedValue({ kind: 'listed', rates: [rate()] })
    removeRate.mockResolvedValue({ kind: 'in-use', products: 3 })

    const wrapper = await rates()
    await wrapper.findAll('button').filter((b) => b.attributes('aria-label'))[0].trigger('click')
    await flushPromises()

    expect(wrapper.find('.in-use').text()).toContain('3 products carry this rate')
  })
})
