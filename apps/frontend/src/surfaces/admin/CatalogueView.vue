<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/shared/ui/Button.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import ProductTable from '@/surfaces/admin/ProductTable.vue'
import { listProducts, type ProductPage } from '@/shared/api/catalogue'

const { t } = useI18n()

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
         (docs/design/catalog.md § 7) — the sentence is the table's own empty
         state, so there is nothing here deciding between the two. -->
    <template v-else>
      <ProductTable :products="products" />

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
  font: var(--style-caption);
}

.unreachable {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--colour-danger);
  border-left-width: 3px;
  border-radius: var(--radius-1);
  color: var(--colour-danger);
  font: var(--style-caption-strong);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead th {
  padding: var(--space-1) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  color: var(--colour-text-muted);
  text-align: left;
}

tbody td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  vertical-align: baseline;
}

/* The merchant wrote the title and recognises the row by it, so it wraps
   rather than being cut. */
td.name {
  font: var(--style-body-strong);
}


.state {
  display: inline-flex;
  padding: 0 var(--space-2);
  border: 1px solid currentColor;
  border-radius: var(--radius-pill);
  font: var(--style-caption-strong);
}

.state.published {
  color: var(--colour-accent);
}

.state.draft,
.state.retired {
  color: var(--colour-text-muted);
}






</style>
