<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    /** The permanent rail is tighter than the same list inside the drawer. */
    compact?: boolean
    /**
     * Which section to mark. Given rather than read from the router, so this
     * component is a function of what it is handed and testable without one.
     */
    currentPath?: string
  }>(),
  { compact: false, currentPath: '' },
)

const emit = defineEmits<{ pick: [] }>()

const { t } = useI18n()

// The v1 sections, as the design defines them. Not configurable.
//
// The ones with no screen of their own yet all lead to the dashboard, so only
// the first is ever marked: four sections highlighted at once would say the
// merchant is in all of them.
const sections = [
  { key: 'dashboard', to: '/admin' },
  { key: 'catalogue', to: '/admin' },
  { key: 'orders', to: '/admin' },
  { key: 'content', to: '/admin' },
  { key: 'settings', to: '/admin/settings' },
] as const

function isCurrent(to: string, index: number): boolean {
  return to === '/admin' ? props.currentPath === '/admin' && index === 0 : props.currentPath === to
}
</script>

<template>
  <!-- One list, two densities: the rail on a wide screen and the drawer on a
       narrow one show the same sections, so they are the same component. -->
  <nav
    class="sections"
    :class="{ compact }"
    :aria-label="t('admin.title')"
  >
    <RouterLink
      v-for="(section, index) in sections"
      :key="section.key"
      :to="section.to"
      :class="{ current: isCurrent(section.to, index) }"
      @click="emit('pick')"
    >
      {{ t(`admin.nav.${section.key}`) }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sections a {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-1);
  color: var(--colour-text-muted);
  text-decoration: none;
}

.sections a.current {
  background: var(--colour-accent);
  color: var(--colour-on-accent);
  font-weight: 600;
}

.compact a {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-s);
}
</style>
