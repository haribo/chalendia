import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import PasswordField from '@/shared/ui/PasswordField.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function field(props: Record<string, unknown> = {}) {
  return mount(PasswordField, {
    props: { label: 'Password', ...props },
    global: { plugins: [i18n] },
  })
}

describe('PasswordField', () => {
  it('hides what is typed until asked otherwise', async () => {
    const wrapper = field()
    expect(wrapper.get('input').attributes('type')).toBe('password')

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(wrapper.get('button').text()).toBe('Hide')
  })

  it('offers the reveal, never imposes it', () => {
    // Creating an account blind is the best way to mistype the same thing
    // twice; the default still hides.
    expect(field().get('button').text()).toBe('Show')
  })

  it('never submits the form it sits in', () => {
    expect(field().get('button').attributes('type')).toBe('button')
  })

  it('fills the strength bar as the password grows', async () => {
    const wrapper = field({ minimumLength: 12 })
    expect(wrapper.findAll('.strength span.reached')).toHaveLength(0)

    await wrapper.get('input').setValue('correct')
    expect(wrapper.findAll('.strength span.reached')).toHaveLength(2)

    await wrapper.get('input').setValue('correct horse battery staple')
    expect(wrapper.findAll('.strength span.reached')).toHaveLength(4)
  })

  it('drops the strength bar when asked, whatever is typed', async () => {
    // Signing in uses an existing password: measuring it teaches nobody
    // anything. The bar must go even once the field is full.
    const wrapper = field({ strength: false })

    await wrapper.get('input').setValue('correct horse battery staple')

    expect(wrapper.find('.strength').exists()).toBe(false)
  })

  it('keeps the bar by default', async () => {
    const wrapper = field()

    await wrapper.get('input').setValue('correct horse')

    expect(wrapper.find('.strength').exists()).toBe(true)
  })

  it('reports a refusal with its message', () => {
    const wrapper = field({ error: '5 characters missing' })

    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).toContain('5 characters missing')
  })

  it('locks its reveal along with the field', () => {
    const wrapper = field({ disabled: true })

    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})
