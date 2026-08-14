import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'

import en from '@/i18n/locales/en.json'
import Button from '@/shared/ui/Button.vue'
import Form from '@/shared/ui/Form.vue'
import TextField from '@/shared/ui/TextField.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const Host = defineComponent({
  props: { submitting: { type: Boolean, default: false } },
  emits: ['submit'],
  setup(props, { emit }) {
    return () =>
      h(
        Form,
        { submitting: props.submitting, onSubmit: () => emit('submit') },
        {
          default: () => [h(TextField, { label: 'Shop name' }), h(TextField, { label: 'Currency' })],
          actions: () => h(Button, { type: 'submit', variant: 'primary' }, () => 'Create'),
        },
      )
  },
})

function form(submitting = false) {
  return mount(Host, { props: { submitting }, global: { plugins: [i18n] } })
}

describe('Form', () => {
  it('reports a submission to its caller instead of reloading the page', async () => {
    const wrapper = form()

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('locks every field while the request is away', () => {
    // Passing `disabled` to each field by hand is how one gets forgotten and
    // stays editable while the request is in flight.
    const wrapper = form(true)

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(2)
    expect(inputs.every((input) => input.attributes('disabled') !== undefined)).toBe(true)
  })

  it('leaves the fields alone when nothing is in flight', () => {
    const inputs = form().findAll('input')

    expect(inputs.every((input) => input.attributes('disabled') === undefined)).toBe(true)
  })

  it('lets the browser skip its own validation, so the shop decides', () => {
    // Native bubbles would answer before the server does, in the browser's
    // words and its language.
    expect(form().get('form').attributes('novalidate')).toBeDefined()
  })
})
