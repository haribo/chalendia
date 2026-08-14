import { describe, expect, it } from 'vitest'

import { fieldErrorsFrom } from './setup-errors'

describe('placing the API refusals on their fields', () => {
  it('keeps the words when they say something the value does not', () => {
    // "5 characters missing" cannot be deduced from looking at the dots.
    const errors = fieldErrorsFrom([
      { name: 'administratorPassword', reason: '5 characters missing' },
    ])

    expect(errors.administratorPassword).toBe('5 characters missing')
  })

  it('marks the field without words when the value already shows the problem', () => {
    const errors = fieldErrorsFrom([{ name: 'currency' }, { name: 'administratorEmail' }])

    // An empty string still means invalid — the field draws its border and
    // tells assistive technology, it simply has nothing to add.
    expect(errors.currency).toBe('')
    expect(errors.administratorEmail).toBe('')
  })

  it('places every refusal, not just the first', () => {
    const errors = fieldErrorsFrom([
      { name: 'name' },
      { name: 'legalIdentity' },
      { name: 'administratorPassword', reason: '7 characters missing' },
    ])

    expect(Object.keys(errors).sort()).toEqual([
      'administratorPassword',
      'legalIdentity',
      'name',
    ])
  })

  it('ignores a field it does not display', () => {
    // A refusal about something not on this screen must not silently land on
    // an unrelated field.
    expect(fieldErrorsFrom([{ name: 'somethingElse' }])).toEqual({})
  })

  it('marks nothing when there is nothing to mark', () => {
    expect(fieldErrorsFrom(undefined)).toEqual({})
    expect(fieldErrorsFrom([])).toEqual({})
  })
})
