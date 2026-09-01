import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { NARROW, useNarrowScreen } from '@/composables/useNarrowScreen'

/** A media query the test drives, since jsdom answers none of its own. */
function stubMatchMedia(matches: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = []
  const query = {
    matches,
    media: NARROW,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.push(listener),
    removeEventListener: vi.fn(),
  }

  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(query))

  return {
    query,
    widen: (value: boolean) => {
      for (const listener of listeners) listener({ matches: value } as MediaQueryListEvent)
    },
  }
}

const Probe = defineComponent({
  setup: () => useNarrowScreen(),
  template: '<p>{{ narrow }}</p>',
})

afterEach(() => vi.unstubAllGlobals())

describe('useNarrowScreen', () => {
  it('reads the width it is mounted at', async () => {
    stubMatchMedia(true)

    // Read on mount, so the value lands one render after the first one.
    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('true')
  })

  it('follows the window as it changes', async () => {
    const { widen } = stubMatchMedia(true)
    const wrapper = mount(Probe)

    widen(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('false')
  })

  it('stops listening when the surface goes away', () => {
    const { query } = stubMatchMedia(true)

    mount(Probe).unmount()

    expect(query.removeEventListener).toHaveBeenCalled()
  })

  /** Server-side, or anywhere without a window: the wide shape is the default. */
  it('assumes wide where nothing can be measured', async () => {
    vi.stubGlobal('matchMedia', undefined)

    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('false')
  })
})
