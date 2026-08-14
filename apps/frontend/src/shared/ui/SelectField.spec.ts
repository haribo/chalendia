import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import SelectField from '@/shared/ui/SelectField.vue'

const OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
]

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

/** In a form: framed like every other field. */
function field(props: Record<string, unknown> = {}) {
  return mount(SelectField, {
    props: { label: 'Language', options: OPTIONS, modelValue: 'en', ...props },
    global: { plugins: [i18n] },
  })
}

/** In a bar: no frame, among other controls. */
function bare(props: Record<string, unknown> = {}) {
  return field({ bare: true, ...props })
}

describe.each([
  ['framed', field],
  ['bare', bare],
])('SelectField (%s)', (_name, build) => {
  it('associates its label with the control by id', () => {
    const wrapper = build()

    const id = wrapper.get('select').attributes('id')

    expect(id).toBeTruthy()
    expect(wrapper.get('label').attributes('for')).toBe(id)
  })

  it('keeps the label readable by assistive technology', () => {
    // Never `hidden` or `display: none`: both would remove it from the
    // accessibility tree along with the pixels.
    const wrapper = build()

    expect(wrapper.get('label').text()).toContain('Language')
    expect(wrapper.find('[hidden]').exists()).toBe(false)
  })

  it('renders one option per entry, in the order given', () => {
    const options = build().findAll('option')

    expect(options.map((option) => option.text())).toEqual(['EN', 'FR'])
    expect(options.map((option) => option.attributes('value'))).toEqual(['en', 'fr'])
  })

  it('shows the current value as selected', () => {
    expect(build({ modelValue: 'fr' }).get('select').element.value).toBe('fr')
  })

  it('reports a choice to its caller', async () => {
    const wrapper = build()

    await wrapper.get('select').setValue('fr')

    expect(wrapper.emitted('update:modelValue')).toEqual([['fr']])
  })

  it('locks with the form it sits in', () => {
    expect(build({ disabled: true }).get('select').attributes('disabled')).toBeDefined()
  })
})

describe('SelectField in a form', () => {
  it('keeps its label in the border, because a select is never empty', () => {
    // Nothing to rest inside the control: there is always a chosen option.
    expect(field().get('.frame').classes()).toContain('notched')
  })

  it('reports a refusal to assistive technology', () => {
    const wrapper = field({ error: '' })

    expect(wrapper.get('select').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('.frame').classes()).toContain('invalid')
  })
})
