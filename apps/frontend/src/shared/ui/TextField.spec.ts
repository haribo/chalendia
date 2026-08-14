import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import TextField from '@/shared/ui/TextField.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function field(props: Record<string, unknown> = {}) {
  return mount(TextField, {
    props: { label: 'Shop name', ...props },
    global: { plugins: [i18n] },
  })
}

describe('TextField', () => {
  it('associates its label with the control', () => {
    const wrapper = field()

    const id = wrapper.get('input').attributes('id')

    expect(id).toBeTruthy()
    expect(wrapper.get('label').attributes('for')).toBe(id)
  })

  it('is required unless it says otherwise, and marks only the exception', () => {
    expect(field().get('input').attributes('required')).toBeDefined()
    expect(field().text()).not.toContain('optional')

    const optional = field({ optional: true })

    expect(optional.get('input').attributes('required')).toBeUndefined()
    expect(optional.text()).toContain('optional')
  })

  it('opens the notch once there is a value to make room for', async () => {
    const wrapper = field()
    expect(wrapper.get('.frame').classes()).not.toContain('notched')

    await wrapper.get('input').setValue('La Fabrique')

    expect(wrapper.get('.frame').classes()).toContain('notched')
  })

  it('lifts the label out of the way as soon as the field is focused', async () => {
    // Otherwise the caret lands on top of the label in an empty field.
    const wrapper = field()

    await wrapper.get('input').trigger('focus')
    expect(wrapper.get('.frame').classes()).toContain('notched')

    await wrapper.get('input').trigger('blur')
    expect(wrapper.get('.frame').classes()).not.toContain('notched')
  })

  it('reports a refusal to assistive technology even with no message', () => {
    // The border says it to whoever can see it; this says it to whoever cannot.
    const wrapper = field({ error: '' })

    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('.frame').classes()).toContain('invalid')
  })

  it('shows a message only when there is one to show', () => {
    expect(field({ error: '' }).find('.error').exists()).toBe(false)

    const explained = field({ error: 'already used by another account' })

    expect(explained.get('.error').text()).toContain('already used by another account')
  })

  it('leaves a healthy field unmarked', () => {
    const wrapper = field()

    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.get('.frame').classes()).not.toContain('invalid')
  })

  it('describes the control by its hint', () => {
    const wrapper = field({ hint: 'Appears on every invoice.' })

    const id = wrapper.get('input').attributes('id')

    expect(wrapper.get('input').attributes('aria-describedby')).toBe(`${id}-hint`)
    expect(wrapper.get(`#${id}-hint`).text()).toBe('Appears on every invoice.')
  })

  it('carries the typed value back to its caller', async () => {
    const wrapper = field()

    await wrapper.get('input').setValue('La Fabrique à Savons')

    expect(wrapper.emitted('update:modelValue')).toEqual([['La Fabrique à Savons']])
  })
})
