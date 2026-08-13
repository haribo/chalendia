<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import AppBar from '@/shared/ui/AppBar.vue'
import AppShell from '@/shared/ui/AppShell.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { SHOP_NAME } from '@/shared/shop'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const { hasStaffRole } = storeToRefs(useSessionStore())
</script>

<template>
  <AppShell>
    <template #bar>
      <AppBar :title="SHOP_NAME">
        <template #actions>
          <LanguagePicker />
          <ThemePicker />
          <!-- Only offered to someone who can use it; the API refuses the rest. -->
          <NavLink
            v-if="hasStaffRole"
            to="/admin"
          >
            {{ t('storefront.toAdmin') }}
          </NavLink>
        </template>
      </AppBar>
    </template>

    <main class="canvas">
      <RouterView />
    </main>

    <template #footer>
      <footer class="foot">
        <span>{{ t('storefront.legal.terms') }}</span>
        <span>{{ t('storefront.legal.notice') }}</span>
        <span>{{ t('storefront.legal.privacy') }}</span>
      </footer>
    </template>
  </AppShell>
</template>

<style scoped>
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
