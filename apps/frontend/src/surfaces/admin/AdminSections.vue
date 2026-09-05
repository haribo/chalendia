<script setup lang="ts">
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

import IconCatalogue from '@/shared/ui/icons/IconCatalogue.vue'
import IconContent from '@/shared/ui/icons/IconContent.vue'
import IconDashboard from '@/shared/ui/icons/IconDashboard.vue'
import IconOrders from '@/shared/ui/icons/IconOrders.vue'
import IconSettings from '@/shared/ui/icons/IconSettings.vue'

const props = withDefaults(
  defineProps<{
    /** The permanent rail is tighter than the same list inside the drawer. */
    compact?: boolean
    /**
     * Which section to mark. Given rather than read from the router, so this
     * component is a function of what it is handed and testable without one.
     */
    currentPath?: string
    /** Icons alone. The name stays, for assistive technology and the tooltip. */
    folded?: boolean
  }>(),
  { compact: false, currentPath: '', folded: false },
)

const emit = defineEmits<{ pick: [] }>()

const { t } = useI18n()

// The v1 sections, as the design defines them. Not configurable.
//
// The ones with no screen of their own yet all lead to the dashboard, so only
// the first is ever marked: four sections highlighted at once would say the
// merchant is in all of them.
const sections: readonly { key: string; to: string; icon: Component }[] = [
  { key: 'dashboard', to: '/admin', icon: IconDashboard },
  { key: 'catalogue', to: '/admin/catalogue', icon: IconCatalogue },
  { key: 'orders', to: '/admin', icon: IconOrders },
  { key: 'content', to: '/admin', icon: IconContent },
  { key: 'settings', to: '/admin/settings', icon: IconSettings },
]

function isCurrent(to: string, index: number): boolean {
  if (to === '/admin') {
    return props.currentPath === '/admin' && index === 0
  }

  // A screen under a section belongs to it: creating a product is still being
  // in the catalogue, and the navigation should not say otherwise.
  return props.currentPath === to || props.currentPath.startsWith(`${to}/`)
}
</script>

<template>
  <!-- One list, two densities: the rail on a wide screen and the drawer on a
       narrow one show the same sections, so they are the same component. -->
  <nav
    class="sections"
    :class="{ compact, folded }"
    :aria-label="t('admin.title')"
  >
    <RouterLink
      v-for="(section, index) in sections"
      :key="section.key"
      :to="section.to"
      :class="{ current: isCurrent(section.to, index) }"
      :title="folded ? t(`admin.nav.${section.key}`) : undefined"
      @click="emit('pick')"
    >
      <component :is="section.icon" />
      <!-- Folded, the name is still read aloud: an icon nobody can name is a
           section nobody can reach without sight. -->
      <span :class="{ 'visually-hidden': folded }">{{ t(`admin.nav.${section.key}`) }}</span>
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
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-1);
  color: var(--colour-text-muted);
  text-decoration: none;
}

.sections a.current {
  background: var(--colour-accent);
  color: var(--colour-on-accent);
  font: var(--style-body-strong);
}

.compact a {
  padding: var(--space-1) var(--space-2);
  gap: var(--space-2);
  font: var(--style-caption);
}

.folded a {
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
}
</style>
