import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import SettingsView from '@/surfaces/admin/SettingsView.vue'
import { useSessionStore } from '@/stores/session'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function page() {
  return mount(SettingsView, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().staff = { email: 'owner@fabrique-savons.fr', role: 'administrator' }
})

describe('SettingsView', () => {
  it('carries the two preferences that left the bar', () => {
    const labels = page()
      .findAll('label')
      .map((label) => label.text())

    expect(labels).toContain('Interface language')
    expect(labels).toContain('Theme')
  })

  /**
   * The address is read here and nowhere else in the back office
   * (docs/design/core.md § 4), so this is the one screen that must show it.
   */
  it('names who is signed in', () => {
    expect(page().text()).toContain('owner@fabrique-savons.fr')
  })

  it('says nothing about an account it does not have', () => {
    useSessionStore().forget()

    expect(page().text()).not.toContain('Signed in as')
  })

  /** A preference applies as it is chosen; there is nothing to submit. */
  it('offers no save button', () => {
    expect(page().findAll('button')).toHaveLength(0)
  })

  it('frames the pickers, unlike the same ones in a bar', () => {
    // The bare form carries no fieldset; the framed one is what a form field
    // looks like everywhere else in the shop.
    expect(page().findAll('fieldset').length).toBeGreaterThanOrEqual(2)
  })
})
