import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/i18n/locales/en.json'
import SystemStatusPanel from '@/surfaces/admin/SystemStatusPanel.vue'
import type { SystemStatus } from '@/shared/api/health'

const readHealth = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/health', () => ({ readHealth }))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

function panel() {
  return mount(SystemStatusPanel, { global: { plugins: [i18n] } })
}

function answers(status: SystemStatus) {
  readHealth.mockResolvedValue(status)
}

describe('the system status panel', () => {
  beforeEach(() => {
    readHealth.mockReset()
  })

  it('announces that it is reading before anything is known', () => {
    answers({ kind: 'loading' })

    const wrapper = panel()

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Reading the system status')
  })

  it('reports both components when the shop is healthy', async () => {
    answers({ kind: 'reachable', health: { status: 'ok', service: 'chalendia-backend', database: 'up' } })

    const wrapper = panel()
    await flushPromises()

    expect(wrapper.text()).toContain('Serving')
    expect(wrapper.text()).toContain('Reachable')
    expect(wrapper.attributes('aria-busy')).toBe('false')
  })

  it('says what the merchant loses when the database is unreachable', async () => {
    answers({
      kind: 'reachable',
      health: { status: 'degraded', service: 'chalendia-backend', database: 'unreachable' },
    })

    const wrapper = panel()
    await flushPromises()

    expect(wrapper.text()).toContain('Unreachable')
    // The consequence before the cause: the merchant needs to know the shop
    // cannot take orders, not that a socket refused.
    expect(wrapper.text()).toContain('can neither record an order')
  })

  it('never shows a database state it does not know', async () => {
    answers({ kind: 'unreachable' })

    const wrapper = panel()
    await flushPromises()

    expect(wrapper.text()).toContain('Not answering')
    expect(wrapper.text()).not.toContain('Reachable')
    expect(wrapper.text()).not.toContain('Database')
  })

  it('offers the only useful action, and asks again when it is taken', async () => {
    answers({ kind: 'unreachable' })
    const wrapper = panel()
    await flushPromises()
    expect(readHealth).toHaveBeenCalledTimes(1)

    answers({ kind: 'reachable', health: { status: 'ok', service: 'chalendia-backend', database: 'up' } })
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(readHealth).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Serving')
  })

  it('reads once and does not poll', async () => {
    answers({ kind: 'reachable', health: { status: 'ok', service: 'chalendia-backend', database: 'up' } })

    panel()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(readHealth).toHaveBeenCalledTimes(1)
  })
})
