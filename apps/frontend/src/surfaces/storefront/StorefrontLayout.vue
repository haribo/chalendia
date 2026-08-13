<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { SHOP_NAME } from '@/shared/shop'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const { hasStaffRole } = storeToRefs(useSessionStore())
</script>

<template>
  <div class="shell">
    <header class="bar">
      <p class="brand">
        {{ SHOP_NAME }}
      </p>
      <div class="actions">
        <LanguagePicker />
        <ThemePicker />
        <!-- Only offered to someone who can use it; the API refuses the rest. -->
        <RouterLink
          v-if="hasStaffRole"
          class="link"
          to="/admin"
        >
          {{ t('storefront.toAdmin') }}
        </RouterLink>
      </div>
    </header>

    <main class="canvas">
      <RouterView />
    </main>

    <footer class="foot">
      <span>{{ t('storefront.legal.terms') }}</span>
      <span>{{ t('storefront.legal.notice') }}</span>
      <span>{{ t('storefront.legal.privacy') }}</span>
    </footer>
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

.canvas {
  flex: 1;
  padding: var(--space-8) var(--space-4);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
