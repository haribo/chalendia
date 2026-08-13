import { describe, expect, it } from 'vitest'

import { resolveGuard, routes } from '@/router'
import type { RouteLocationNormalized } from 'vue-router'

function location(requiresStaff: boolean): RouteLocationNormalized {
  return {
    matched: [{ meta: requiresStaff ? { requiresStaff: true } : {} }],
  } as unknown as RouteLocationNormalized
}

describe('the back-office guard', () => {
  it('sends a visitor without a staff role back to the shop', () => {
    expect(resolveGuard(location(true), false)).toEqual({ name: 'home' })
  })

  it('lets a staff member through', () => {
    expect(resolveGuard(location(true), true)).toBe(true)
  })

  it('leaves storefront routes alone', () => {
    expect(resolveGuard(location(false), false)).toBe(true)
  })
})

describe('route definitions', () => {
  it('loads the back office lazily so it never weighs on a shopper', () => {
    const admin = routes.find((route) => route.path === '/admin')

    expect(typeof admin?.component).toBe('function')
  })

  it('marks the back office as staff-only', () => {
    const admin = routes.find((route) => route.path === '/admin')

    expect(admin?.meta?.requiresStaff).toBe(true)
  })
})
