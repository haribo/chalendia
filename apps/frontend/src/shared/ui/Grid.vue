<script setup lang="ts">
import { computed } from 'vue'

/**
 * A grid that reflows on its own, from a minimum column width rather than from
 * a column count and a pile of breakpoints.
 *
 * `auto-fill` and not `auto-fit`: with `auto-fit` a single item stretches to
 * the whole width, so one product photograph among ten renders at a different
 * size than its neighbours did a moment earlier.
 */
const props = withDefaults(
  defineProps<{
    /**
     * The narrowest a column may be before the grid drops one. In `rem`, since
     * a column holds text and text scales with the reader's font size.
     */
    minColumn?: number
    /** A step on the spacing scale, `--space-1` through `--space-8`. */
    gap?: 1 | 2 | 3 | 4 | 6 | 8
    as?: 'div' | 'ul' | 'ol' | 'section'
  }>(),
  { minColumn: 12, gap: 4, as: 'div' },
)

const style = computed(() => ({
  // `min()` rather than the bare minimum: below it, a column wider than the
  // viewport is what makes a page scroll sideways on a phone — which
  // `docs/design/core.md` § 8 forbids outright.
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${props.minColumn}rem, 100%), 1fr))`,
  gap: `var(--space-${props.gap})`,
}))
</script>

<template>
  <component
    :is="as"
    class="grid"
    :style="style"
  >
    <slot />
  </component>
</template>

<style scoped>
.grid {
  display: grid;
  min-width: 0;
}

.grid:where(ul, ol) {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
