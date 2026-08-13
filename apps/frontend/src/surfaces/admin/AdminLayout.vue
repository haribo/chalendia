<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppBar from '@/shared/ui/AppBar.vue'
import AppShell from '@/shared/ui/AppShell.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'

const { t } = useI18n()

// The v1 sections, as the design defines them. Not configurable.
const sections = [
  { key: 'dashboard', to: '/admin' },
  { key: 'catalogue', to: '/admin' },
  { key: 'orders', to: '/admin' },
  { key: 'content', to: '/admin' },
  { key: 'settings', to: '/admin' },
] as const
</script>

<template>
  <AppShell>
    <template #bar>
      <AppBar :title="t('admin.title')">
        <template #actions>
          <LanguagePicker />
          <ThemePicker />
          <NavLink to="/">
            {{ t('admin.toShop') }}
          </NavLink>
        </template>
      </AppBar>
    </template>

    <div class="workspace">
      <nav
        class="side"
        :aria-label="t('admin.title')"
      >
        <RouterLink
          v-for="(section, index) in sections"
          :key="section.key"
          :to="section.to"
          :class="{ current: index === 0 }"
        >
          {{ t(`admin.nav.${section.key}`) }}
        </RouterLink>
      </nav>

      <main class="canvas">
        <RouterView />
      </main>
    </div>
  </AppShell>
</template>

<style scoped>
.workspace {
  display: grid;
  flex: 1;
  grid-template-columns: 11rem 1fr;
}

.side {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-2);
  border-right: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
}

.side a {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-1);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
  text-decoration: none;
}

.side a.current {
  background: var(--colour-accent);
  color: var(--colour-on-accent);
  font-weight: 600;
}

.canvas {
  padding: var(--space-6) var(--space-4);
}
</style>
