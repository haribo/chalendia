<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const session = useSessionStore()
</script>

<template>
  <section class="settings">
    <PageTitle>{{ t('settings.title') }}</PageTitle>

    <!-- What belongs to the person, kept apart from what belongs to the shop
         (docs/design/core.md § 4). The shop's own settings join it here under
         a second group, with their own issue. -->
    <section class="group">
      <h2>{{ t('settings.preferences') }}</h2>
      <p
        v-if="session.staff"
        class="about"
      >
        {{ t('settings.about', { email: session.staff.email }) }}
      </p>

      <!-- Framed, unlike the same pickers in the bars of setup and sign-in:
           here they are fields on a page, not controls beside a title. -->
      <LanguagePicker />
      <ThemePicker />
    </section>
  </section>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: start;
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 34rem;
}

h2 {
  margin: 0;
  font-size: var(--text-m);
  font-weight: 600;
}

.about {
  margin: calc(var(--space-4) * -1) 0 0;
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
