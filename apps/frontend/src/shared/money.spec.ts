import { describe, expect, it } from 'vitest'

import { formatAmount, minorDigits, parseAmount } from '@/shared/money'

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
