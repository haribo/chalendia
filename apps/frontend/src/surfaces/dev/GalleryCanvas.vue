<script setup lang="ts">
/**
 * The one frame a section gets.
 *
 * One frame, not one per variant: a border around every specimen turns a row
 * of four buttons into a row of four boxes, and the eye reads the boxes. What
 * the frame separates is the rendered design from the prose about it — that is
 * the whole job.
 */
withDefaults(
  defineProps<{
    /** Lay the variants out in a column, for anything full-width like a field. */
    stacked?: boolean
  }>(),
  { stacked: false },
)
</script>

<template>
  <div
    class="canvas"
    :class="{ stacked }"
  >
    <slot />
  </div>
</template>

<style scoped>
.canvas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-2);
  background: var(--colour-surface-raised);
  min-width: 0;
}

.canvas.stacked {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
}

/* The frame spans the column; the fields inside it stop where a field stops on
   a real screen — `SettingsView` gives its own group the same width. A frame
   cut off at half the column reads as a rendering fault. */
.canvas.stacked > * {
  max-width: 34rem;
}
</style>
