<script setup lang="ts">
import { computed } from 'vue'

/**
 * One direction, one gap. The thing every surface was writing by hand — a
 * count of the back office before this component existed found 24 flex rules,
 * 16 of them a column, and every gap already taken from a spacing token.
 *
 * The gap is a **step**, never a length: a component that accepts `0.7rem`
 * gives back by prop exactly what the tokens exist to prevent.
 */
const props = withDefaults(
  defineProps<{
    /** Column is the common case, so it is the default. */
    direction?: 'column' | 'row'
    /** A step on the spacing scale, `--space-1` through `--space-8`. */
    gap?: 1 | 2 | 3 | 4 | 6 | 8
    /** Cross-axis alignment. `baseline` is for a label sitting beside a value. */
    align?: 'stretch' | 'start' | 'center' | 'baseline' | 'end'
    /** Main-axis distribution. Only what a surface has actually needed. */
    justify?: 'start' | 'between'
    /** A row that wraps rather than pushing the page sideways. */
    wrap?: boolean
    /** The element to render. A list of things is a `ul`, not a stack of divs. */
    as?: 'div' | 'ul' | 'ol' | 'section' | 'header' | 'footer' | 'nav'
  }>(),
  {
    direction: 'column',
    gap: 3,
    align: 'stretch',
    justify: 'start',
    wrap: false,
    as: 'div',
  },
)

const style = computed(() => ({
  flexDirection: props.direction,
  gap: `var(--space-${props.gap})`,
  alignItems: props.align === 'start' || props.align === 'end' ? `flex-${props.align}` : props.align,
  justifyContent: props.justify === 'between' ? 'space-between' : 'flex-start',
  flexWrap: props.wrap ? ('wrap' as const) : ('nowrap' as const),
}))
</script>

<template>
  <component
    :is="as"
    class="stack"
    :style="style"
  >
    <slot />
  </component>
</template>

<style scoped>
.stack {
  display: flex;
  /* A flex child refuses to shrink below its content by default, which is how
     a long product name pushes a whole page sideways. */
  min-width: 0;
}

/* `as="ul"` renders a list, and a list still carries its own bullets and
   padding. The stack is the layout; the markup only says what the thing is. */
.stack:where(ul, ol) {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
