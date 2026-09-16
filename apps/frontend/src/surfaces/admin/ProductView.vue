<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { readProduct, type ProductSummary } from '@/shared/api/catalogue'
import { formatAmount, formatRate } from '@/shared/money'
import Alert from '@/shared/ui/Alert.vue'
import NavLink from '@/shared/ui/NavLink.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import Pill from '@/shared/ui/Pill.vue'
import Stack from '@/shared/ui/Stack.vue'
import IconCheckCircle from '@/shared/ui/icons/IconCheckCircle.vue'
import IconEdit from '@/shared/ui/icons/IconEdit.vue'
import IconVisibilityOff from '@/shared/ui/icons/IconVisibilityOff.vue'
import ProductPhotographs from '@/surfaces/admin/ProductPhotographs.vue'
import { useShopStore } from '@/stores/shop'

/**
 * One product, as the back office reads it
 * (`docs/design/catalog.md` § 7, *Opening a product*).
 *
 * The facts the list carried in columns, without the columns — then the
 * product's photographs, as a section. There is no screen of photographs: a
 * catalogue holds products, and an interface that leads from a catalogue
 * straight to one aspect of a product has skipped the product.
 *
 * Reading and editing are two jobs. This screen does the first; the second
 * brings a form, a refusal per field, and a question about what an unsaved
 * change means when the merchant leaves.
 */
const props = defineProps<{ id: string }>()

const { t, locale } = useI18n()
const shop = useShopStore()

const product = ref<ProductSummary | undefined>(undefined)
const missing = ref(false)

const productId = computed(() => Number(props.id))

onMounted(async () => {
  const outcome = await readProduct(productId.value)
  if (outcome.kind === 'product') {
    product.value = outcome.product
  } else {
    missing.value = true
  }
})

/** One currency per shop, so a missing one means the shop was never asked. */
const price = computed(() =>
  product.value === undefined
    ? ''
    : shop.currency
      ? formatAmount(product.value.price, shop.currency, locale.value)
      : String(product.value.price),
)

const rate = computed(() =>
  product.value?.vatBasisPoints == null
    ? undefined
    : formatRate(product.value.vatBasisPoints, locale.value),
)

/**
 * Draft and retired share the neutral tone and mean opposite things — still
 * being written, versus taken out of sight. The icon tells them apart, and the
 * caller chooses it (`Pill` never derives one).
 */
const stateIcon = computed(() =>
  product.value === undefined
    ? undefined
    : { draft: IconEdit, published: IconCheckCircle, retired: IconVisibilityOff }[
        product.value.state
      ],
)
</script>

<template>
  <Stack :gap="6">
    <Stack :gap="2">
      <p class="crumb">
        <NavLink to="/admin/catalogue">
          {{ t('catalogue.title') }}
        </NavLink>
      </p>
      <PageTitle>{{ product?.title ?? '' }}</PageTitle>
    </Stack>

    <Alert v-if="missing">
      {{ t('catalogue.product.missing') }}
    </Alert>

    <template v-if="product">
      <!-- Definition pairs rather than a table: four label-and-value couples
           that wrap when the room runs out. A two-column table on a single row
           would be a table of nothing. -->
      <dl class="facts">
        <div class="fact">
          <dt>{{ t('catalogue.column.reference') }}</dt>
          <dd class="code">
            {{ product.merchantReference ?? '—' }}
          </dd>
        </div>
        <div class="fact">
          <dt>{{ t('catalogue.column.price') }}</dt>
          <dd class="number">
            {{ price }}
          </dd>
        </div>
        <div
          v-if="shop.vatEnabled"
          class="fact"
        >
          <dt>{{ t('catalogue.column.vat') }}</dt>
          <dd class="number">
            {{ rate ?? '—' }}
          </dd>
        </div>
        <div class="fact">
          <dt>{{ t('catalogue.column.state') }}</dt>
          <dd>
            <Pill
              :tone="product.state === 'published' ? 'accent' : 'neutral'"
              :icon="stateIcon"
            >
              {{ t(`catalogue.state.${product.state}`) }}
            </Pill>
          </dd>
        </div>
      </dl>

      <hr class="divider">

      <ProductPhotographs :product-id="productId" />
    </template>
  </Stack>
</template>

<style scoped>
.crumb {
  margin: 0;
  color: var(--colour-text-muted);
  font: var(--style-caption);
}

.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  align-items: baseline;
  margin: 0;
}

.fact {
  display: flex;
  flex-direction: column;
}

.fact dt {
  margin: 0;
  color: var(--colour-text-muted);
  font: var(--style-caption);
}

.fact dd {
  margin: 0;
  font: var(--style-body);
}

.fact dd.number {
  font-variant-numeric: tabular-nums;
}

.fact dd.code {
  color: var(--colour-text-muted);
  font: var(--style-caption);
  font-family: var(--font-mono);
}

.divider {
  height: 1px;
  margin: 0;
  border: 0;
  background: var(--colour-border);
}
</style>
