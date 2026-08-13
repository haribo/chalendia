<script setup lang="ts">
defineProps<{
  /** What this surface calls itself: the shop's name, or the back office. */
  title: string
}>()
</script>

<template>
  <header class="bar">
    <p class="title">
      {{ title }}
    </p>
    <div class="actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
}

/* Takes the space, and gives it back: a long shop name is truncated rather
   than pushing the actions off screen. */
.title {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: var(--text-l);
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}
</style>
