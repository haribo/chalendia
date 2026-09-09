<script setup lang="ts">
import type { Component } from 'vue'

/**
 * A state, read at a glance.
 *
 * A tone belongs here because a pill's identity **is** the state it names —
 * the same colour on a button would be wrong, since a button's identity is the
 * action it performs (frontend ADR 0003 § 4).
 *
 * **The icon is passed, never derived from the tone.** A product's `draft` and
 * `retired` share the neutral tone and say opposite things — one is still being
 * written, the other was taken out of sight. Deriving the icon would make them
 * indistinguishable, which is the very fault an icon is here to prevent: colour
 * never carries meaning alone (`docs/design/core.md` § 8, WCAG 1.4.1).
 *
 * Nothing animates. A state is read, not watched.
 */
withDefaults(
  defineProps<{
    /** What kind of state this is, never what it is used for. */
    tone?: 'neutral' | 'accent' | 'warning' | 'danger'
    /** From `shared/ui/icons`, so the whole set stays Material Symbols. */
    icon?: Component
  }>(),
  { tone: 'neutral', icon: undefined },
)
</script>

<template>
  <span
    class="pill"
    :class="tone"
  >
    <component
      :is="icon"
      v-if="icon"
      size="xs"
    />
    <slot />
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
  font: var(--style-caption-strong);
  white-space: nowrap;
}

.neutral {
  color: var(--colour-text-muted);
}

.accent {
  color: var(--colour-accent);
}

.warning {
  color: var(--colour-warning);
}

.danger {
  color: var(--colour-danger);
}
</style>
