import { beforeEach, describe, expect, it } from 'vitest'

import { setTheme, useTheme } from '@/composables/useTheme'

describe('the theme choice', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    setTheme('system')
  })

  it('leaves the system preference in charge by default', () => {
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('stamps the root so an explicit choice overrides the system preference', () => {
    setTheme('dark')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('overrides the system preference in the other direction too', () => {
    setTheme('light')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('hands the choice back to the system when asked', () => {
    setTheme('dark')
    setTheme('system')

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('remembers the choice for the next visit', () => {
    setTheme('dark')

    expect(localStorage.getItem('chalendia.theme')).toBe('dark')
    expect(useTheme().choice.value).toBe('dark')
  })
})
