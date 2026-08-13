<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="dashboard">
    <h1>{{ t('admin.dashboard.title') }}</h1>
    <p class="notice">
      {{ t('admin.dashboard.noPaymentMethod') }}
    </p>
  </section>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  text-wrap: balance;
}

.notice {
  max-width: 38ch;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--colour-border);
  border-left: 3px solid var(--colour-accent);
  border-radius: var(--radius-1);
  background: var(--colour-surface-raised);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
