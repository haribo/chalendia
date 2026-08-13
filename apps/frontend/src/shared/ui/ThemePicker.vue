<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { THEME_CHOICES, useTheme, type ThemeChoice } from '@/composables/useTheme'

const { t } = useI18n()
const { choice, setTheme } = useTheme()
const id = useId()

function onChange(event: Event): void {
  setTheme((event.target as HTMLSelectElement).value as ThemeChoice)
}
</script>

<template>
  <label
    :for="id"
    class="picker"
  >
    <span class="visually-hidden">{{ t('theme.label') }}</span>
    <select
      :id="id"
      :value="choice"
      @change="onChange"
    >
      <option
        v-for="value in THEME_CHOICES"
        :key="value"
        :value="value"
      >
        {{ t(`theme.${value}`) }}
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
