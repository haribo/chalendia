<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectField from '@/shared/ui/SelectField.vue'
import { THEME_CHOICES, useTheme, type ThemeChoice } from '@/composables/useTheme'

const { t } = useI18n()
const { choice, setTheme } = useTheme()

const options = computed(() =>
  THEME_CHOICES.map((value) => ({ value, label: t(`theme.${value}`) })),
)

const selected = computed({
  get: () => choice.value,
  set: (value: string) => setTheme(value as ThemeChoice),
})
</script>

<template>
  <SelectField
    v-model="selected"
    :label="t('theme.label')"
    :options="options"
  />
</template>
