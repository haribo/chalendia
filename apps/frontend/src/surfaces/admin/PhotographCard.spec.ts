import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import fr from '@/i18n/locales/fr.json'
import type { ProductImage } from '@/shared/api/images'
import PhotographCard from '@/surfaces/admin/PhotographCard.vue'

const i18n = createI18n({ legacy: false, locale: 'fr', messages: { fr } })

function photograph(over: Partial<ProductImage> = {}): ProductImage {
  return {
    id: 7,
    reference: '0123456789abcdef0123456789abcdef',
    position: 0,
    alternativeText: 'Savon au miel',
    state: 'ready',
    width: 2400,
    height: 1600,
    ...over,
  }
}

function card(props: Partial<InstanceType<typeof PhotographCard>['$props']> = {}) {
  return mount(PhotographCard, {
    props: { image: photograph(), rank: 2, first: false, last: false, locked: false, ...props },
    global: { plugins: [i18n] },
  })
}

const named = (wrapper: ReturnType<typeof card>, label: string) =>
  wrapper.get(`[aria-label="${label}"]`)

describe('a photograph in the back office', () => {
  it('states its rank as a digit', () => {
    // A digit, not an ordinal: on a photograph it reads as a position.
    expect(card({ rank: 3 }).get('.rank').text()).toBe('3')
  })

  it('shows the photograph with its description as the alternative text', () => {
    const image = card().get('img')

    expect(image.attributes('src')).toContain('0123456789abcdef0123456789abcdef')
    expect(image.attributes('alt')).toBe('Savon au miel')
  })

  it('leaves the alternative text empty rather than inventing one', () => {
    // An empty alt is what tells a screen reader to skip a decorative image;
    // a filename or a placeholder would be read aloud as if it meant something.
    expect(card({ image: photograph({ alternativeText: null }) }).get('img').attributes('alt')).toBe('')
  })

  it('names the state it is in, for whoever cannot see the glyph', () => {
    // `get` throws when nothing matches, which is the assertion: a state with
    // no accessible name is a state only a sighted merchant has.
    expect(() => named(card({ image: photograph({ state: 'pending' }) }), 'En préparation')).not.toThrow()
    expect(() => named(card({ image: photograph({ state: 'failed' }) }), 'Échec')).not.toThrow()
  })

  it('says nothing about a photograph that is simply ready', () => {
    expect(card().find('.badge').exists()).toBe(false)
  })

  it('offers to try again only when the preparation failed', () => {
    expect(card().find('[aria-label="Réessayer"]').exists()).toBe(false)
    expect(
      card({ image: photograph({ state: 'failed' }) }).find('[aria-label="Réessayer"]').exists(),
    ).toBe(true)
  })

  it('disables the chevron at either end rather than hiding it', async () => {
    // Disabled and not absent: the group keeps its width, and the digit stays
    // where the eye left it from one card to the next.
    const firstOne = card({ first: true })

    expect(named(firstOne, 'Reculer cette photographie').attributes('disabled')).toBeDefined()
    expect(named(firstOne, 'Avancer cette photographie').attributes('disabled')).toBeUndefined()

    const lastOne = card({ last: true })
    expect(named(lastOne, 'Avancer cette photographie').attributes('disabled')).toBeDefined()
  })

  it('asks to be moved when a chevron is pressed', async () => {
    const wrapper = card()

    await named(wrapper, 'Reculer cette photographie').trigger('click')
    await named(wrapper, 'Avancer cette photographie').trigger('click')

    expect(wrapper.emitted('moveBack')).toHaveLength(1)
    expect(wrapper.emitted('moveForward')).toHaveLength(1)
  })

  it('locks what touches the list while an upload is in flight, and nothing else', () => {
    const wrapper = card({ locked: true })

    expect(named(wrapper, 'Reculer cette photographie').attributes('disabled')).toBeDefined()
    expect(named(wrapper, 'Avancer cette photographie').attributes('disabled')).toBeDefined()
    expect(named(wrapper, 'Retirer cette photographie').attributes('disabled')).toBeDefined()
    // The description changes one photograph, not the list, so it stays open —
    // which is the whole distinction the locking rests on.
    expect(wrapper.get('input').attributes('disabled')).toBeUndefined()
  })

  it('saves a description when the field is left, not on every keystroke', async () => {
    const wrapper = card()

    await wrapper.get('input').setValue('Savon au miel sur un linge écru')
    expect(wrapper.emitted('describe')).toBeUndefined()

    await wrapper.get('.field').trigger('focusout')
    expect(wrapper.emitted('describe')).toEqual([['Savon au miel sur un linge écru']])
  })

  it('says nothing when the description was not touched', async () => {
    const wrapper = card()

    await wrapper.get('.field').trigger('focusout')

    expect(wrapper.emitted('describe')).toBeUndefined()
  })

  it('sends null to take a description away', async () => {
    // Blank is absent: the back office flags a photograph without one, and two
    // ways of having none would need flagging twice.
    const wrapper = card()

    await wrapper.get('input').setValue('   ')
    await wrapper.get('.field').trigger('focusout')

    expect(wrapper.emitted('describe')).toEqual([[null]])
  })

  it('takes the shop’s answer over what was typed', async () => {
    // A reorder answers with every image; a field holding stale text would
    // quietly overwrite a description fixed elsewhere.
    const wrapper = card()

    await wrapper.get('input').setValue('à moitié écrit')
    await wrapper.setProps({ image: photograph({ alternativeText: 'ce que la boutique tient' }) })

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('ce que la boutique tient')
  })
})
