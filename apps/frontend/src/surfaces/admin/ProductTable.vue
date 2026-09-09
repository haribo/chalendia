<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconCheckCircle from '@/shared/ui/icons/IconCheckCircle.vue'
import IconEdit from '@/shared/ui/icons/IconEdit.vue'
import IconVisibilityOff from '@/shared/ui/icons/IconVisibilityOff.vue'
import Table from '@/shared/ui/Table.vue'
import type { Column, Row } from '@/shared/ui/table'
import type { ProductSummary } from '@/shared/api/catalogue'
import { formatAmount, formatRate } from '@/shared/money'
import { useShopStore } from '@/stores/shop'

/**
 * The catalogue as a table: a product turned into typed cells.
 *
 * This is where the domain lives — a price is money, a rate is a rate, a state
 * is a state — and [`Table`](@/shared/ui/Table.vue) below it knows none of
 * that (frontend ADR 0004).
 */
defineProps<{ products: readonly ProductSummary[] }>()

const { t, locale } = useI18n()
const shop = useShopStore()

const columns = computed<Column[]>(() =>
  [
    { key: 'title', header: t('catalogue.column.product') },
    { key: 'reference', header: t('catalogue.column.reference') },
    { key: 'price', header: t('catalogue.column.price'), align: 'end' as const },
    ...(shop.vatEnabled
      ? [{ key: 'vat', header: t('catalogue.column.vat'), align: 'end' as const }]
      : []),
    { key: 'state', header: t('catalogue.column.state') },
  ].filter(Boolean),
)

/** One currency per shop, so a missing one means the shop was never asked. */
function price(minor: number): string {
  return shop.currency ? formatAmount(minor, shop.currency, locale.value) : String(minor)
}

function rowOf(product: ProductSummary): Row {
  return {
    key: product.id,
    cells: {
      title: { kind: 'strong', value: product.title },
      // The shop sends `null` for a reference nobody typed; the cell's
      // language for absence is `undefined`, and translating between the two
      // is this component's job rather than the table's.
      reference: { kind: 'code', value: product.merchantReference ?? undefined },
      price: { kind: 'number', value: price(product.price) },
      // Which rate, not how much tax: the amount follows from the price
      // already in the row, and the rate is what a merchant scans for when a
      // law changes.
      vat: {
        kind: 'number',
        value:
          product.vatBasisPoints == null
            ? undefined
            : formatRate(product.vatBasisPoints, locale.value),
      },
      state: {
        kind: 'pill',
        value: t(`catalogue.state.${product.state}`),
        // Published is the state a merchant is looking for; the others are
        // where a product is on its way to or back from.
        tone: product.state === 'published' ? 'accent' : 'neutral',
        // Draft and retired share the neutral tone and mean opposite things —
        // still being written, versus taken out of sight. The icon is what
        // tells them apart, and it is the caller's to choose.
        icon: {
          draft: IconEdit,
          published: IconCheckCircle,
          retired: IconVisibilityOff,
        }[product.state],
      },
    },
  }
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="products.map(rowOf)"
    :empty="t('catalogue.empty')"
    :label="t('catalogue.title')"
  />
</template>
