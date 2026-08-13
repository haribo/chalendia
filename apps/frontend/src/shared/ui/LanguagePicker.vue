<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { SUPPORTED_LOCALES, setLocale, type Locale } from '@/i18n'

const { t, locale } = useI18n()
const id = useId()

function onChange(event: Event): void {
  setLocale((event.target as HTMLSelectElement).value as Locale)
}
</script>

<template>
  <label
    :for="id"
    class="picker"
  >
    <span class="visually-hidden">{{ t('language.label') }}</span>
    <select
      :id="id"
      :value="locale"
      @change="onChange"
    >
      <option
        v-for="code in SUPPORTED_LOCALES"
        :key="code"
        :value="code"
      >
        {{ code.toUpperCase() }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.picker {
  display: inline-flex;
}

select {
  appearance: none;
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  background: var(--colour-surface);
  color: var(--colour-text-muted);
  font: inherit;
  font-size: var(--text-s);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
