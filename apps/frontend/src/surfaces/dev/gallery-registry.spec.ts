import { describe, expect, it } from 'vitest'

import {
  anchorOf,
  FAMILIES,
  NOT_COMPONENTS,
  NOT_SHOWN,
  SHOWN,
} from '@/surfaces/dev/gallery-registry'

/**
 * The test that keeps the gallery from becoming a museum
 * (frontend ADR 0003 § 6).
 *
 * A gallery is only worth reading while it matches the component set. Nothing
 * reminds anyone to add a section, so this walks the directory instead — a
 * component added tomorrow fails this test until it is either shown or
 * exempted with a reason.
 */
const files = import.meta.glob('@/shared/ui/*.vue')

const components = Object.keys(files)
  .map((path) => path.split('/').pop()!.replace('.vue', ''))
  .sort()

describe('the gallery registry', () => {
  it('accounts for every shared component', () => {
    const accounted = new Set<string>([...SHOWN, ...Object.keys(NOT_SHOWN)])
    const forgotten = components.filter((name) => !accounted.has(name))

    expect(forgotten, `add these to the gallery, or to NOT_SHOWN with a reason: ${forgotten}`).toEqual(
      [],
    )
  })

  it('names nothing that no longer exists', () => {
    // A registry that outlives its components sends a reader looking for a
    // section that renders nothing.
    const existing = new Set(components)
    const stale = [...SHOWN, ...Object.keys(NOT_SHOWN)].filter((name) => !existing.has(name))

    expect(stale, `these are in the registry but not in shared/ui: ${stale}`).toEqual([])
  })

  it('gives every exemption a reason worth reading', () => {
    // An exemption with an empty string is a component waved through. The
    // length is arbitrary; what it rules out is not.
    for (const [name, reason] of Object.entries(NOT_SHOWN)) {
      expect(reason.length, `${name} is exempted without saying why`).toBeGreaterThan(40)
    }
  })

  it('shows a component once', () => {
    expect(new Set(SHOWN).size).toBe(SHOWN.length)
  })

  it('does not both show and exempt the same component', () => {
    const both = SHOWN.filter((name) => name in NOT_SHOWN)

    expect(both).toEqual([])
  })

  it('files every shown component under exactly one family', () => {
    // Two families claiming one component would render it twice and give the
    // menu two links to the same anchor.
    const filed = FAMILIES.flatMap((family) => [...family.components])

    expect(new Set(filed).size).toBe(filed.length)
    expect([...filed].filter((name) => !NOT_COMPONENTS.includes(name)).sort()).toEqual(
      [...SHOWN].sort(),
    )
  })

  it('keeps the non-component sections out of the component checks', () => {
    // The type scale has a section and an anchor but no file in shared/ui.
    // Without this, the walk above would report it as a stale registry entry.
    for (const name of NOT_COMPONENTS) {
      expect(SHOWN).not.toContain(name)
      // Widened: the families are `as const`, so `components` is a tuple of
      // literals and `includes` would refuse a plain string.
      const filed = FAMILIES.flatMap((family) => [...family.components] as string[])
      expect(filed).toContain(name)
    }
  })

  it('gives every component an anchor of its own', () => {
    // The menu and the sections share this function. Two components resolving
    // to one anchor would send both links to whichever rendered first.
    const anchors = SHOWN.map(anchorOf)

    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it('names a family in words a reader recognises', () => {
    for (const family of FAMILIES) {
      expect(family.label.length).toBeGreaterThan(2)
      expect(family.components.length).toBeGreaterThan(0)
    }
  })
})
