import { describe, expect, it } from 'vitest'

import { COUNTRY_CODES, countryOptions } from '@/shared/countries'

describe('the country list', () => {
  it('holds no duplicate', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length)
  })

  /**
   * A code the platform cannot name is a code that would show as "XX" in the
   * list — which is how a typo in this file reaches a merchant rather than a
   * test. `Intl.DisplayNames` returns the code itself when it knows no name.
   */
  it.each(['en', 'fr'])('names every one of them in %s', (locale) => {
    const unnamed = countryOptions(locale).filter((option) => option.label === option.value)

    expect(unnamed).toEqual([])
  })

  it('names them in the reader language', () => {
    const label = (locale: string) =>
      countryOptions(locale).find((option) => option.value === 'DE')?.label

    expect(label('fr')).toBe('Allemagne')
    expect(label('en')).toBe('Germany')
  })

  it('sorts by the name someone reads, not by the code', () => {
    const french = countryOptions('fr').map((option) => option.label)

    expect(french).toEqual([...french].sort(new Intl.Collator('fr').compare))
    // Under A for its French name, where a code sort would have put it under D.
    expect(french.indexOf('Allemagne')).toBeLessThan(french.indexOf('Belgique'))
  })
})
