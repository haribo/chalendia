<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppBar from '@/shared/ui/AppBar.vue'
import AppShell from '@/shared/ui/AppShell.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { PRODUCT_NAME } from '@/shared/shop'
import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'

const { t } = useI18n()
const { hasStaffRole } = storeToRefs(useSessionStore())
const shop = useShopStore()

// The merchant's own name once the shop is configured; the product's until then.
const title = computed(() => shop.name ?? PRODUCT_NAME)
</script>

<template>
  <AppShell>
    <template #bar>
      <AppBar :title="title">
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
