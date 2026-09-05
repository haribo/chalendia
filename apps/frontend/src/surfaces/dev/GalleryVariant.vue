<script setup lang="ts">
/**
 * A variant whose own label cannot say which variant it is.
 *
 * A button says "primary" in its label and a field says "refusé" in its own;
 * a stack, a grid or a bar has nowhere to write it. Only those get a caption,
 * and it sits under the render rather than inside it.
 */
defineProps<{ label: string }>()
</script>

<template>
  <figure class="variant">
    <slot />
    <figcaption>{{ label }}</figcaption>
  </figure>
</template>

<style scoped>
.variant {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  min-width: 0;
  flex: 1 1 14rem;
}

figcaption {
  font-size: var(--text-s);
  color: var(--colour-text-muted);
}
</style>
