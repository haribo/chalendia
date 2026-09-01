<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/shared/ui/Button.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import { listProducts, type ProductPage } from '@/shared/api/catalogue'
import { useNarrowScreen } from '@/composables/useNarrowScreen'
import { formatAmount, formatRate } from '@/shared/money'
import { useShopStore } from '@/stores/shop'

const { t, locale } = useI18n()
const shop = useShopStore()
const { narrow } = useNarrowScreen()

const page = ref<ProductPage | undefined>(undefined)
const unreachable = ref(false)

const products = computed(() => page.value?.items ?? [])

/** Which of the whole this page covers, for someone paging through it. */
const range = computed(() => {
  const current = page.value
  if (!current || current.total === 0) return undefined

  const from = (current.page - 1) * current.pageSize + 1
  return {
    from,
    to: Math.min(from + current.items.length - 1, current.total),
    total: current.total,
  }
})

function price(minor: number): string {
  // One currency per shop, so a missing one means the shop was never asked.
  return shop.currency ? formatAmount(minor, shop.currency, locale.value) : String(minor)
}

async function load(): Promise<void> {
  const outcome = await listProducts()

  if (outcome.kind === 'listed') {
    page.value = outcome.page
    unreachable.value = false
  } else {
    unreachable.value = true
  }
}

onMounted(load)
</script>

<template>
  <section class="catalogue">
    <header>
      <PageTitle>{{ t('catalogue.title') }}</PageTitle>
      <Button
        variant="primary"
        @click="$router.push('/admin/catalogue/new')"
      >
        {{ t('catalogue.add') }}
      </Button>
    </header>

    <p
      v-if="unreachable"
      class="unreachable"
      role="alert"
    >
      {{ t('catalogue.unreachable') }}
    </p>

    <!-- One screen: the table when there are products, a sentence where the
         table would be when there are none. No second design to maintain
         (docs/design/catalog.md § 7). -->
    <p
      v-else-if="products.length === 0"
      class="empty"
    >
      {{ t('catalogue.empty') }}
    </p>

    <template v-else>
      <table v-if="!narrow">
        <thead>
          <tr>
            <th>{{ t('catalogue.column.product') }}</th>
            <th>{{ t('catalogue.column.reference') }}</th>
            <th class="number">
              {{ t('catalogue.column.price') }}
            </th>
            <th
              v-if="shop.vatEnabled"
              class="number"
            >
              {{ t('catalogue.column.vat') }}
            </th>
            <th>{{ t('catalogue.column.state') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="product in products"
            :key="product.id"
          >
            <td class="name">
              {{ product.title }}
            </td>
            <td class="reference">
              {{ product.merchantReference ?? '—' }}
            </td>
            <td class="number">
              {{ price(product.price) }}
            </td>
            <!-- Which rate, not how much tax: the amount follows from the
                 price already in the row, the rate is what a merchant scans
                 for when a law changes. -->
            <td
              v-if="shop.vatEnabled"
              class="number"
            >
              {{ product.vatBasisPoints == null ? '—' : formatRate(product.vatBasisPoints, locale) }}
            </td>
            <td>
              <span :class="['state', product.state]">{{ t(`catalogue.state.${product.state}`) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Four columns in 412 px leave each about 25 characters, which is a
           table nobody can read: the row becomes a stacked card. -->
      <ul
        v-else
        class="cards"
      >
        <li
          v-for="product in products"
          :key="product.id"
        >
          <span class="name">{{ product.title }}</span>
          <span class="meta">
            <span class="number">{{ price(product.price) }}</span>
            <span
              v-if="shop.vatEnabled && product.vatBasisPoints != null"
              class="vat"
            >{{ t('catalogue.column.vat') }} {{ formatRate(product.vatBasisPoints, locale) }}</span>
            <span :class="['state', product.state]">{{ t(`catalogue.state.${product.state}`) }}</span>
            <span
              v-if="product.merchantReference"
              class="reference"
            >{{ product.merchantReference }}</span>
          </span>
        </li>
      </ul>

      <p
        v-if="range"
        class="paging"
      >
        {{ t('catalogue.paging', range) }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.catalogue {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

header {
  display: flex;
  gap: var(--space-4);
  align-items: baseline;
  justify-content: space-between;
}

.empty,
.paging {
  margin: 0;
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}

.unreachable {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--colour-danger);
  border-left-width: 3px;
  border-radius: var(--radius-1);
  color: var(--colour-danger);
  font-size: var(--text-s);
  font-weight: 600;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-s);
}

thead th {
  padding: var(--space-1) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
}

tbody td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  vertical-align: baseline;
}

/* The merchant wrote the title and recognises the row by it, so it wraps
   rather than being cut. */
td.name {
  font-weight: 600;
}

.reference {
  color: var(--colour-text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-s);
}

.number {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.state {
  display: inline-flex;
  padding: 0 var(--space-2);
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
  font-size: var(--text-s);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.state.published {
  color: var(--colour-accent);
}

.state.draft,
.state.retired {
  color: var(--colour-text-muted);
}

.cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.cards li {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-2);
  background: var(--colour-surface-raised);
}

.cards .name {
  font-weight: 600;
}

.cards .meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
  font-size: var(--text-s);
}

.cards .number {
  text-align: left;
}

.cards .vat {
  color: var(--colour-text-muted);
}
</style>
