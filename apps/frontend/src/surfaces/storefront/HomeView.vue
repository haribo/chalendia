<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="home">
    <h1>{{ t('storefront.welcome') }}</h1>
    <p>{{ t('storefront.noCatalogue') }}</p>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  text-wrap: balance;
}

p {
  max-width: 34ch;
  margin: 0;
  color: var(--colour-text-muted);
}
</style>
