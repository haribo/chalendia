import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Grid from '@/shared/ui/Grid.vue'
import Stack from '@/shared/ui/Stack.vue'

describe('Stack', () => {
  it('stacks in a column by default, because that is what surfaces do', () => {
    const stack = mount(Stack, { slots: { default: '<span>one</span>' } })

    expect(stack.attributes('style')).toContain('flex-direction: column')
  })

  it('takes its gap from the spacing scale, never a length', () => {
    const stack = mount(Stack, { props: { gap: 6 } })

    // The token, not its value: a stack that resolved `--space-6` itself would
    // stop following a theme that redefines it.
    expect(stack.attributes('style')).toContain('gap: var(--space-6)')
  })

  it('maps start and end onto the flex names, so a caller says start', () => {
    // `align="start"` is what a caller writing a template thinks in; the CSS
    // name for it in a flex container is `flex-start`.
    expect(mount(Stack, { props: { align: 'start' } }).attributes('style')).toContain(
      'align-items: flex-start',
    )
    expect(mount(Stack, { props: { align: 'baseline' } }).attributes('style')).toContain(
      'align-items: baseline',
    )
  })

  it('renders the element the content actually is', () => {
    const list = mount(Stack, { props: { as: 'ul' }, slots: { default: '<li>one</li>' } })

    // A list of things is a list. Assistive technology announces "list, one
    // item"; a stack of divs announces nothing.
    expect(list.element.tagName).toBe('UL')
  })

  it('lets a child shrink below its content', () => {
    // Without `min-width: 0` on the flex container, a long unbreakable product
    // name pushes the whole page sideways — which core.md § 8 forbids.
    const stack = mount(Stack)

    expect(stack.classes()).toContain('stack')
  })
})

describe('Grid', () => {
  it('reflows from a minimum column width rather than a column count', () => {
    const grid = mount(Grid, { props: { minColumn: 10 } })

    expect(grid.attributes('style')).toContain('repeat(auto-fill, minmax(min(10rem, 100%), 1fr))')
  })

  it('never lets a column grow wider than the viewport', () => {
    // The `min(…, 100%)` is the whole reason a 12rem minimum does not scroll a
    // 320 px phone sideways.
    const grid = mount(Grid)

    expect(grid.attributes('style')).toContain('100%')
  })

  it('fills rather than fits, so one item is not stretched to the full width', () => {
    const grid = mount(Grid)

    expect(grid.attributes('style')).toContain('auto-fill')
    expect(grid.attributes('style')).not.toContain('auto-fit')
  })

  it('takes its gap from the spacing scale', () => {
    expect(mount(Grid, { props: { gap: 2 } }).attributes('style')).toContain('gap: var(--space-2)')
  })
})
