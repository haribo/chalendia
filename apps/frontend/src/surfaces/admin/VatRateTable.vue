<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconTrash from '@/shared/ui/icons/IconTrash.vue'
import Table from '@/shared/ui/Table.vue'
import type { Column, Row } from '@/shared/ui/table'
import type { VatRate } from '@/shared/api/tax'
import { formatRate } from '@/shared/money'

/**
 * The shop's VAT rates as a table.
 *
 * The screen where a cell has to be described **per row**: the third column
 * carries a pill on the default rate and a button on every other one. A table
 * whose column fixed the kind could not render it — which is why
 * [ADR 0004](../../../../docs/frontend/adr/0004-typed-table-cells.md) settles
 * that a row describes its own cells.
 */
const props = defineProps<{
  rates: readonly VatRate[]
  /** While the shop is answering, nothing is pressable twice. */
  busy: boolean
}>()

const emit = defineEmits<{ promote: [rate: VatRate]; remove: [rate: VatRate] }>()

const { t, locale } = useI18n()

/*
 * No column names anything: a name, a figure, a mark and an action each read
 * for themselves, and the table renders no header row for them.
 */
const columns: Column[] = [
  { key: 'name', header: '' },
  { key: 'rate', header: '', align: 'end' },
  { key: 'mark', header: '', align: 'end' },
  { key: 'act', header: '', align: 'end' },
]

const rows = computed<Row[]>(() =>
  props.rates.map((rate) => ({
    key: rate.id,
    cells: {
      name: { kind: 'strong', value: rate.name },
      rate: { kind: 'number', value: formatRate(rate.basisPoints, locale.value) },
      mark: rate.isDefault
        ? { kind: 'pill', value: t('settings.rates.default'), tone: 'accent' }
        : {
            kind: 'actions',
            actions: [
              {
                label: t('settings.rates.makeDefault'),
                disabled: props.busy,
                onPress: () => emit('promote', rate),
              },
            ],
          },
      act: {
        kind: 'actions',
        actions: [
          {
            label: t('settings.rates.remove', { name: rate.name }),
            icon: IconTrash,
            disabled: props.busy,
            onPress: () => emit('remove', rate),
          },
        ],
      },
    },
  })),
)
</script>

<template>
  <Table
    :columns="columns"
    :rows="rows"
    :empty="t('settings.rates.empty')"
    :label="t('settings.rates.title')"
  />
</template>
