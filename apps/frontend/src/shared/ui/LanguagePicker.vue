<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SelectField from '@/shared/ui/SelectField.vue'
import { SUPPORTED_LOCALES, setLocale, type Locale } from '@/i18n'

const props = withDefaults(
  defineProps<{
    /** In a bar, among other controls, rather than framed in a form. */
    bare?: boolean
  }>(),
  { bare: false },
)

const { t, locale } = useI18n()

// In a bar, the code: someone looking for their language scans for "EN", and a
// name in a language they do not read helps nobody. On a settings page there is
// room for the name, and nothing to scan past.
const options = computed(() =>
  SUPPORTED_LOCALES.map((code) => ({
    value: code,
    label: props.bare ? code.toUpperCase() : t(`language.${code}`),
  })),
)

const selected = computed({
  get: () => locale.value,
  set: (value: string) => setLocale(value as Locale),
})
</script>

<template>
  <SelectField
    v-model="selected"
    :bare="bare"
    :label="bare ? t('language.label') : t('language.interface')"
    :options="options"
  />
</template>
