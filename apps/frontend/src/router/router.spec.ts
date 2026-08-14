import { describe, expect, it } from 'vitest'

import { resolveGuard, resolveSetupGuard, routes } from '@/router'
import type { RouteLocationNormalized } from 'vue-router'

function location(requiresStaff: boolean, fullPath = '/admin'): RouteLocationNormalized {
  return {
    fullPath,
    matched: [{ meta: requiresStaff ? { requiresStaff: true } : {} }],
  } as unknown as RouteLocationNormalized
}

function named(name: string): RouteLocationNormalized {
  return { name, matched: [] } as unknown as RouteLocationNormalized
}

describe('the setup guard', () => {
  it('sends every route to setup while no shop exists', () => {
    expect(resolveSetupGuard(named('home'), false)).toEqual({ name: 'setup' })
    expect(resolveSetupGuard(named('admin-dashboard'), false)).toEqual({ name: 'setup' })
  })

  it('lets setup itself through, or nothing could ever be configured', () => {
    expect(resolveSetupGuard(named('setup'), false)).toBe(true)
  })

  it('stops interfering once the shop exists', () => {
    expect(resolveSetupGuard(named('home'), true)).toBe(true)
    // Setup stays reachable and says it is over, rather than vanishing.
    expect(resolveSetupGuard(named('setup'), true)).toBe(true)
  })
})

describe('the back-office guard', () => {
  it('sends a visitor without a session to sign in', () => {
    expect(resolveGuard(location(true), false)).toEqual({
      name: 'sign-in',
      query: { next: '/admin' },
    })
  })

  it('remembers the page that was asked for', () => {
    // Signing in must land where the visitor was going, not on a default page.
    expect(resolveGuard(location(true, '/admin/orders/12'), false)).toEqual({
      name: 'sign-in',
      query: { next: '/admin/orders/12' },
    })
  })

  it('does not ask someone already signed in to sign in again', () => {
    const signInPage = { name: 'sign-in', matched: [] } as unknown as RouteLocationNormalized

    expect(resolveGuard(signInPage, true)).toEqual({ name: 'admin-dashboard' })
    expect(resolveGuard(signInPage, false)).toBe(true)
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

  it('serves setup at its own route, lazily', () => {
    const setup = routes.find((route) => route.name === 'setup')

    expect(setup).toBeDefined()
    expect(typeof setup?.component).toBe('function')
  })

  it('marks the back office as staff-only', () => {
    const admin = routes.find((route) => route.path === '/admin')

    expect(admin?.meta?.requiresStaff).toBe(true)
  })
})
