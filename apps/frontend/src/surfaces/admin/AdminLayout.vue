<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
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
  <div class="shell">
    <header class="bar">
      <p class="brand">
        {{ t('admin.title') }}
      </p>
      <div class="actions">
        <LanguagePicker />
        <ThemePicker />
        <RouterLink
          class="link"
          to="/"
        >
          {{ t('admin.toShop') }}
        </RouterLink>
      </div>
    </header>

    <div class="body">
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
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
}

.brand {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: var(--text-l);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

.link {
  color: var(--colour-accent);
  font-size: var(--text-s);
  text-decoration: none;
  white-space: nowrap;
}

.link:hover,
.link:focus-visible {
  text-decoration: underline;
}

.body {
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
