import { describe, expect, it } from 'vitest'

import { FALLBACK_LOCALE, resolveInitialLocale } from '@/i18n'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'

describe('choosing the initial language', () => {
  it('honours a stored choice over the browser', () => {
    expect(resolveInitialLocale('fr', ['en-GB'])).toBe('fr')
  })

  it('falls back to the browser when nothing is stored', () => {
    expect(resolveInitialLocale(null, ['fr-CA', 'en'])).toBe('fr')
  })

  it('ignores a stored value that is not a supported language', () => {
    expect(resolveInitialLocale('kl', ['en'])).toBe('en')
  })

  it('uses the fallback when the browser asks for nothing we speak', () => {
    expect(resolveInitialLocale(null, ['is-IS'])).toBe(FALLBACK_LOCALE)
  })
})

describe('translation catalogues', () => {
  function keysOf(value: unknown, prefix = ''): string[] {
    if (typeof value !== 'object' || value === null) {
      return [prefix]
    }
    return Object.entries(value).flatMap(([key, nested]) =>
      keysOf(nested, prefix ? `${prefix}.${key}` : key),
    )
  }

  it('describe the same keys in both languages', () => {
    // A key present in one catalogue and missing in the other shows the raw
    // key to whoever chose that language.
    expect(keysOf(fr).sort()).toEqual(keysOf(en).sort())
  })

  it('leave no empty string behind', () => {
    const values = [en, fr].flatMap((catalogue) =>
      keysOf(catalogue).map((key) =>
        key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue),
      ),
    )

    expect(values.every((value) => typeof value === 'string' && value.trim().length > 0)).toBe(true)
  })
})
