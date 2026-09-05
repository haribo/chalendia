<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink
    class="link text-caption"
    :to="to"
  >
    <slot />
  </RouterLink>
</template>

<style scoped>
.link {
  color: var(--colour-accent);
  text-decoration: none;
  white-space: nowrap;
}

/* Plain in a bar, underlined the moment it is aimed at: the position says it
   is a link, the interaction confirms it. */
.link:hover,
.link:focus-visible {
  text-decoration: underline;
}
</style>
