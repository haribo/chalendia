<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import PageTitle from '@/shared/ui/PageTitle.vue'

const { t } = useI18n()
</script>

<template>
  <section class="home">
    <PageTitle>{{ t('storefront.welcome') }}</PageTitle>
    <p>{{ t('storefront.noCatalogue') }}</p>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

p {
  max-width: 34ch;
  margin: 0;
  color: var(--colour-text-muted);
}
</style>
