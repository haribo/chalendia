import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import AdminSections from '@/surfaces/admin/AdminSections.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function sections(props: Record<string, unknown> = {}) {
  return mount(AdminSections, {
    props,
    global: {
      plugins: [i18n],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  })
}

describe('AdminSections', () => {
  it('lists the sections the design defines, in order', () => {
    const labels = sections()
      .findAll('a')
      .map((link) => link.text())

    expect(labels).toEqual(['Dashboard', 'Catalogue', 'Orders', 'Content', 'Settings'])
  })

  it('names itself, so two navigations on one page stay distinguishable', () => {
    expect(sections().get('nav').attributes('aria-label')).toBe('Administration')
  })

  // What closes the drawer once a section was chosen (#41): the same list is
  // shown permanently on a wide screen, where the event is simply ignored.
  it('reports that a section was picked', async () => {
    const wrapper = sections()

    await wrapper.findAll('a')[1].trigger('click')

    expect(wrapper.emitted('pick')).toHaveLength(1)
  })
})

describe('AdminSections, marking where the merchant is', () => {
  const marked = (path: string) =>
    sections({ currentPath: path })
      .findAll('a.current')
      .map((link) => link.text())

  it('marks the section of the page being shown', () => {
    expect(marked('/admin/catalogue')).toEqual(['Catalogue'])
    expect(marked('/admin/settings')).toEqual(['Settings'])
  })

  /** Creating a product is still being in the catalogue. */
  it('marks the section a deeper screen belongs to', () => {
    expect(marked('/admin/catalogue/new')).toEqual(['Catalogue'])
  })

  /**
   * The sections with no screen of their own all lead to the dashboard, so
   * only the first is ever marked: four at once would say the merchant is in
   * all of them.
   */
  it('marks one section at most when several share a destination', () => {
    expect(marked('/admin')).toEqual(['Dashboard'])
  })
})

describe('AdminSections, folded', () => {
  function folded() {
    return sections({ folded: true })
  }

  it('shows an icon for every section', () => {
    expect(folded().findAll('a svg')).toHaveLength(5)
  })

  /**
   * An icon nobody can name is a section nobody can reach without sight, and
   * Catalogue and Content are the two most confusable symbols (#53).
   */
  it('keeps every name readable to assistive technology', () => {
    const names = folded()
      .findAll('a')
      .map((link) => link.text())

    expect(names).toEqual(['Dashboard', 'Catalogue', 'Orders', 'Content', 'Settings'])
  })

  it('hides those names from the eye, and only then', () => {
    expect(folded().findAll('a span.visually-hidden')).toHaveLength(5)
    expect(sections().findAll('a span.visually-hidden')).toHaveLength(0)
  })

  it('titles each link, so hovering says what the symbol means', () => {
    const titles = folded()
      .findAll('a')
      .map((link) => link.attributes('title'))

    expect(titles).toEqual(['Dashboard', 'Catalogue', 'Orders', 'Content', 'Settings'])
    expect(sections().findAll('a')[0].attributes('title')).toBeUndefined()
  })
})
