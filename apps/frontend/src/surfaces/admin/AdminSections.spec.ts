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
