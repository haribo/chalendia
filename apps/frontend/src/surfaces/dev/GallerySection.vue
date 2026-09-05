<script setup lang="ts">
import Stack from '@/shared/ui/Stack.vue'
import { anchorOf } from '@/surfaces/dev/gallery-registry'

/**
 * One component, its contract in a line, and its states laid out side by side.
 *
 * The heading and the note sit **outside** the specimens, never drawn on top
 * of them: a label rendered inside a specimen is a label that ships.
 */
const props = defineProps<{
  /** The component's own name, as it is imported. */
  name: string
  /** What it is for, in one line. Not what it looks like — that is below it. */
  contract: string
}>()

/** Shared with the side menu, so a link cannot point at a heading that moved. */
const anchor = anchorOf(props.name)
</script>

<template>
  <Stack
    :id="anchor"
    as="section"
    :gap="3"
    class="section"
  >
    <Stack :gap="1">
      <h3 class="name">
        {{ name }}
      </h3>
      <p class="contract">
        {{ contract }}
      </p>
    </Stack>
    <slot />
  </Stack>
</template>

<style scoped>
.section {
  padding-top: var(--space-6);
  border-top: 1px solid var(--colour-border);
  /* The sticky menu would otherwise sit on the heading a link just jumped to. */
  scroll-margin-top: var(--space-4);
}

.name {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-m);
  font-weight: 600;
}

.contract {
  margin: 0;
  max-width: 60ch;
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
