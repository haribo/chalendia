import { describe, expect, it } from 'vitest'

import { fit, LONG_SIDE } from '@/shared/images/prepare'

describe('fit', () => {
  it('leaves a photograph the shop already keeps alone', () => {
    // Exactly unchanged, not merely small enough: re-encoding a file that needs
    // nothing costs quality for no reason, and the caller compares the two.
    const small = { width: 1200, height: 900 }

    expect(fit(small)).toEqual(small)
  })

  it('leaves a photograph at the limit alone', () => {
    const atTheLimit = { width: LONG_SIDE, height: 1600 }

    expect(fit(atTheLimit)).toEqual(atTheLimit)
  })

  it('reduces the long side to the limit, whichever side that is', () => {
    expect(fit({ width: 4000, height: 3000 })).toEqual({ width: 2400, height: 1800 })
    expect(fit({ width: 3000, height: 4000 })).toEqual({ width: 1800, height: 2400 })
  })

  it('keeps the ratio', () => {
    const ratio = (s: { width: number; height: number }) => s.width / s.height

    for (const size of [
      { width: 6000, height: 4000 },
      { width: 4032, height: 3024 },
      { width: 2401, height: 2400 },
      { width: 8000, height: 1000 },
    ]) {
      // Within a pixel of rounding: the numbers are integers, so the ratio
      // cannot be kept exactly and pretending otherwise would be a false test.
      expect(ratio(fit(size))).toBeCloseTo(ratio(size), 2)
    }
  })

  it('never returns a side of zero', () => {
    // A panorama reduced by its long side would floor its short one to nothing,
    // and a canvas of zero width throws rather than producing an empty picture.
    const sliver = fit({ width: 24000, height: 5 })

    expect(sliver.width).toBe(2400)
    expect(sliver.height).toBeGreaterThanOrEqual(1)
  })

  it('takes the limit it is given', () => {
    expect(fit({ width: 1000, height: 500 }, 200)).toEqual({ width: 200, height: 100 })
  })
})
