import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SelectField from '@/shared/ui/SelectField.vue'

const OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'fr', label: 'FR' },
]

function field(modelValue = 'en') {
  return mount(SelectField, {
    props: { label: 'Language', options: OPTIONS, modelValue },
  })
}

describe('SelectField', () => {
  it('associates its label with the control by id', () => {
    const wrapper = field()

    const id = wrapper.get('select').attributes('id')

    expect(id).toBeTruthy()
    expect(wrapper.get('label').attributes('for')).toBe(id)
  })

  it('keeps the label available to assistive technology without showing it', () => {
    const wrapper = field()

    // Hidden by clipping, not by display:none or hidden — both would remove it
    // from the accessibility tree along with the pixels.
    expect(wrapper.get('label span').text()).toBe('Language')
    expect(wrapper.find('[hidden]').exists()).toBe(false)
  })

  it('renders one option per entry, in the order given', () => {
    const options = field().findAll('option')

    expect(options.map((option) => option.text())).toEqual(['EN', 'FR'])
    expect(options.map((option) => option.attributes('value'))).toEqual(['en', 'fr'])
  })

  it('shows the current value as selected', () => {
    expect(field('fr').get('select').element.value).toBe('fr')
  })

  it('reports a choice to its caller', async () => {
    const wrapper = field()

    await wrapper.get('select').setValue('fr')

    expect(wrapper.emitted('update:modelValue')).toEqual([['fr']])
  })
})
