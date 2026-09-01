import { beforeEach, describe, expect, it } from 'vitest'

import { useFoldedRail } from '@/composables/useFoldedRail'

const STORAGE_KEY = 'chalendia.rail-folded'

beforeEach(() => {
  localStorage.clear()
  // The state is module-level, so each test starts from the same side.
  const { folded } = useFoldedRail()
  folded.value = false
})

describe('useFoldedRail', () => {
  it('starts unfolded, since the words are what tell the sections apart', () => {
    expect(useFoldedRail().folded.value).toBe(false)
  })

  it('remembers the choice', () => {
    const { folded, toggle } = useFoldedRail()

    toggle()

    expect(folded.value).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  })

  it('folds back', () => {
    const { folded, toggle } = useFoldedRail()

    toggle()
    toggle()

    expect(folded.value).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  })
})
