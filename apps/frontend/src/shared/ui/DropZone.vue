<script setup lang="ts">
/* eslint-disable vuejs-accessibility/no-static-element-interactions */
import { ref } from 'vue'

/**
 * Somewhere to drop files, around whatever the caller puts inside it.
 *
 * Dropping is never the only way in: a pointer that can drag is not a given,
 * and this zone always surrounds a picker that works without one. What it adds
 * is the shortcut for a merchant whose files are already in front of them.
 *
 * The drag handlers sit on a plain element, which the accessibility rule below
 * is disabled for. There is no role meaning "things can be dropped here", and
 * `button` would announce an action this does not have — so the guarantee is
 * the one above: the keyboard path is always inside.
 */
defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{ dropped: [File[]] }>()

/**
 * Depth rather than a flag: dragging over a child fires `dragleave` on the
 * parent, and a boolean would flicker the zone off every time the pointer
 * crossed the button inside it.
 */
const depth = ref(0)

function over(event: DragEvent) {
  // Without this the browser navigates to the file instead of handing it over.
  event.preventDefault()
}

function enter() {
  depth.value += 1
}

function leave() {
  depth.value = Math.max(0, depth.value - 1)
}

function dropped(event: DragEvent) {
  event.preventDefault()
  depth.value = 0

  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) {
    emit('dropped', files)
  }
}
</script>

<template>
  <div
    class="zone"
    :class="{ over: depth > 0 && !disabled }"
    @dragenter="enter"
    @dragover="over"
    @dragleave="leave"
    @drop="disabled ? undefined : dropped($event)"
  >
    <slot />
  </div>
</template>

<style scoped>
.zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  border: 1px dashed var(--colour-border);
  border-radius: var(--radius-2);
  background: var(--colour-surface-raised);
  text-align: center;
}

.zone.over {
  border-style: solid;
  border-color: var(--colour-accent);
  background: var(--colour-accent-quiet);
}
</style>
