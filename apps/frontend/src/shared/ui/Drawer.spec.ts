import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import Drawer from '@/shared/ui/Drawer.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

/**
 * jsdom carries no dialog behaviour: `showModal` and `close` are simply absent,
 * so the component's calls are recorded here and the behaviour they stand for —
 * the focus staying inside, Escape closing — is covered by the mobile journey
 * in a real browser (see #41).
 */
function stubDialogMethods(): { showModal: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } {
  const showModal = vi.fn()
  const close = vi.fn()
  Object.assign(HTMLDialogElement.prototype, { showModal, close })
  return { showModal, close }
}

function drawer(props: Record<string, unknown> = {}) {
  return mount(Drawer, {
    props: { open: false, label: 'Administration', ...props },
    slots: { default: '<a href="/admin" class="section">Catalogue</a>' },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

beforeEach(() => {
  document.body.className = ''
})

describe('Drawer', () => {
  it('opens as a modal dialog and closes again', async () => {
    const { showModal, close } = stubDialogMethods()
    const wrapper = drawer()

    await wrapper.setProps({ open: true })
    expect(showModal).toHaveBeenCalled()

    await wrapper.setProps({ open: false })
    expect(close).toHaveBeenCalled()
  })

  it('holds the page still while it is open', async () => {
    stubDialogMethods()
    const wrapper = drawer()

    await wrapper.setProps({ open: true })
    expect(document.body.classList.contains('scroll-locked')).toBe(true)

    await wrapper.setProps({ open: false })
    expect(document.body.classList.contains('scroll-locked')).toBe(false)
  })

  it('releases the page when it disappears while open', async () => {
    stubDialogMethods()
    const wrapper = drawer({ open: true })

    await wrapper.setProps({ open: true })
    wrapper.unmount()

    expect(document.body.classList.contains('scroll-locked')).toBe(false)
  })

  it('names itself for assistive technology', () => {
    stubDialogMethods()

    expect(drawer().get('dialog').attributes('aria-label')).toBe('Administration')
  })

  /**
   * What a closed drawer keeps in the document is found by anything searching
   * the page, and duplicates whatever the bar already shows — which is how a
   * journey ended up finding one address twice (#41).
   */
  it('keeps nothing in the document while it is closed', async () => {
    stubDialogMethods()
    const wrapper = drawer()

    expect(wrapper.find('.section').exists()).toBe(false)

    await wrapper.setProps({ open: true })
    expect(wrapper.find('.section').exists()).toBe(true)

    await wrapper.setProps({ open: false })
    expect(wrapper.find('.section').exists()).toBe(false)
  })

  it('asks to close when the backdrop is pressed', async () => {
    stubDialogMethods()
    const wrapper = drawer({ open: true })

    // A press on the backdrop reports the dialog itself as the target.
    wrapper.get('dialog').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays open when its own content is pressed', async () => {
    stubDialogMethods()
    const wrapper = drawer({ open: true })

    await wrapper.get('.section').trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('asks to close when the browser closes it, which is what Escape does', async () => {
    stubDialogMethods()
    const wrapper = drawer({ open: true })

    await wrapper.get('dialog').trigger('close')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('offers a close button that says what it does', async () => {
    stubDialogMethods()
    const wrapper = drawer({ open: true })

    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Close')

    await button.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
