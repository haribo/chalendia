<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectField from '@/shared/ui/SelectField.vue'
import { SUPPORTED_LOCALES, setLocale, type Locale } from '@/i18n'

const { t, locale } = useI18n()

// The code, not the language name: a visitor looking for their language scans
// for "EN", and a name in a language they do not read helps nobody.
const options = computed(() =>
  SUPPORTED_LOCALES.map((code) => ({ value: code, label: code.toUpperCase() })),
)

const selected = computed({
  get: () => locale.value,
  set: (value: string) => setLocale(value as Locale),
})
</script>

<template>
  <SelectField
    v-model="selected"
    :label="t('language.label')"
    :options="options"
  />
</template>
