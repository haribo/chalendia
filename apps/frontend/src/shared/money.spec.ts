import { describe, expect, it } from 'vitest'

import { formatAmount, formatRate, minorDigits, parseAmount, taxWithin } from '@/shared/money'

describe('formatAmount', () => {
  it('shows minor units as the amount a person reads', () => {
    expect(formatAmount(690, 'EUR', 'fr')).toMatch(/6,90/)
    expect(formatAmount(690, 'EUR', 'en')).toMatch(/6\.90/)
  })

  it('carries the currency symbol', () => {
    expect(formatAmount(2400, 'EUR', 'fr')).toContain('€')
  })

  it('respects a currency with no minor unit', () => {
    expect(minorDigits('JPY', 'en')).toBe(0)
    expect(formatAmount(690, 'JPY', 'en')).toMatch(/690/)
  })
})

describe('parseAmount', () => {
  it('accepts both separators, because both are typed', () => {
    expect(parseAmount('6,90', 'EUR', 'fr')).toBe(690)
    expect(parseAmount('6.90', 'EUR', 'fr')).toBe(690)
  })

  /** Binary floating point loses a cent here if the result is truncated. */
  it('rounds rather than truncates', () => {
    expect(parseAmount('6.90', 'EUR', 'en')).toBe(690)
    expect(parseAmount('19.99', 'EUR', 'en')).toBe(1999)
    expect(parseAmount('0.07', 'EUR', 'en')).toBe(7)
  })

  it('reads a whole number as its major units', () => {
    expect(parseAmount('24', 'EUR', 'fr')).toBe(2400)
  })

  it('says nothing about what is not a number', () => {
    expect(parseAmount('', 'EUR', 'fr')).toBeUndefined()
    expect(parseAmount('six euros', 'EUR', 'fr')).toBeUndefined()
    expect(parseAmount('6,9,0', 'EUR', 'fr')).toBeUndefined()
  })

  it('reads a negative as a negative, and leaves the refusal to the shop', () => {
    expect(parseAmount('-3', 'EUR', 'fr')).toBe(-300)
  })
})

describe('taxWithin', () => {
  it('derives the tax a price already contains', () => {
    // 6,90 € at 20 %: 5,75 € before tax, 1,15 € of VAT.
    expect(taxWithin(690, 2000)).toEqual({ net: 575, tax: 115 })
  })

  it('handles a rate with a fraction', () => {
    // 7,50 € at 5,5 %: 7,11 € before tax, 0,39 € of VAT.
    expect(taxWithin(750, 550)).toEqual({ net: 711, tax: 39 })
  })

  it('adds nothing at a zero rate', () => {
    expect(taxWithin(690, 0)).toEqual({ net: 690, tax: 0 })
  })

  /** The two parts must add back up, or a total is wrong by a cent. */
  it.each([690, 750, 1999, 2400, 7, 100_000])('splits %i without losing a unit', (amount) => {
    const { tax, net } = taxWithin(amount, 2000)

    expect(net + tax).toBe(amount)
  })
})

describe('formatRate', () => {
  it('reads basis points as a percentage', () => {
    expect(formatRate(2000, 'en')).toMatch(/20\s*%/)
    expect(formatRate(550, 'fr')).toMatch(/5,5\s*%/)
  })
})
