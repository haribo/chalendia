import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import Alert from '@/shared/ui/Alert.vue'
import Pill from '@/shared/ui/Pill.vue'

const Glyph = defineComponent({ name: 'Glyph', render: () => h('svg') })

describe('Pill', () => {
  it('says what it is asked to say', () => {
    const pill = mount(Pill, { slots: { default: 'Publié' } })

    expect(pill.text()).toBe('Publié')
  })

  it('is neutral unless told otherwise', () => {
    // The safe default: a tone claims something about a state, and a component
    // that claims by default claims wrongly on the screen that forgot to say.
    expect(mount(Pill).classes()).toContain('neutral')
  })

  it('takes the icon it is given rather than deriving one', () => {
    // Draft and retired share the neutral tone and mean opposite things. If the
    // icon came from the tone they would be indistinguishable — which is the
    // fault an icon is here to prevent.
    const pill = mount(Pill, { props: { icon: Glyph }, slots: { default: 'Brouillon' } })

    expect(pill.findComponent(Glyph).exists()).toBe(true)
  })

  it('renders without an icon when none is given', () => {
    expect(mount(Pill, { slots: { default: 'Sans' } }).find('svg').exists()).toBe(false)
  })

  it('carries each tone it declares', () => {
    for (const tone of ['neutral', 'accent', 'warning', 'danger'] as const) {
      expect(mount(Pill, { props: { tone } }).classes()).toContain(tone)
    }
  })

  it('never animates', () => {
    // A state is read, not watched. Asserted on the rendered markup so a
    // spinner cannot come back through a class somebody adds later.
    const pill = mount(Pill, { props: { icon: Glyph }, slots: { default: 'En préparation' } })

    expect(pill.html()).not.toMatch(/animation|animate|spin/i)
  })
})

describe('Alert', () => {
  it('announces itself, so it reaches someone not looking at it', () => {
    const alert = mount(Alert, { slots: { default: 'La boutique n’a pas répondu.' } })

    // The role is the component's, never the caller's to remember — which is
    // what the four hand-written alerts each had to.
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('La boutique n’a pas répondu.')
  })

  it('speaks of danger unless told otherwise', () => {
    // Most of what a shop has to say unprompted is a refusal.
    expect(mount(Alert).classes()).toContain('danger')
  })

  it('derives its icon from its tone, and shows a different one per tone', () => {
    // Unlike a pill: news of one kind always looks the same, so the caller has
    // nothing to choose and nothing to get wrong.
    const drawn = new Set(
      (['danger', 'warning', 'success'] as const).map(
        (tone) => mount(Alert, { props: { tone } }).find('svg path').attributes('d'),
      ),
    )

    expect(drawn.size).toBe(3)
  })

  it('carries each tone it declares', () => {
    for (const tone of ['danger', 'warning', 'success'] as const) {
      expect(mount(Alert, { props: { tone } }).classes()).toContain(tone)
    }
  })
})
