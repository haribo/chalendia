<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Alert from '@/shared/ui/Alert.vue'
import Button from '@/shared/ui/Button.vue'
import VatRateTable from '@/surfaces/admin/VatRateTable.vue'
import TextField from '@/shared/ui/TextField.vue'
import {
  addRate,
  listRates,
  makeDefault,
  removeRate,
  type VatRate,
} from '@/shared/api/tax'
import { fieldErrorsFrom } from '@/shared/api/field-errors'

const { t } = useI18n()

const rates = ref<VatRate[]>([])
const name = ref('')
const percent = ref('')
const busy = ref(false)
const errors = ref<{ name?: string; basisPoints?: string }>({})
/** How many products carry the rate whose removal was refused. */
const inUse = ref<number | undefined>(undefined)

const KNOWN = { name: true, basisPoints: true } as const

const sorted = computed(() => rates.value)

function apply(outcome: Awaited<ReturnType<typeof listRates>>): void {
  if (outcome.kind === 'listed') {
    rates.value = outcome.rates
    errors.value = {}
    inUse.value = undefined
  } else if (outcome.kind === 'refused') {
    errors.value = fieldErrorsFrom(outcome.params, KNOWN)
  } else if (outcome.kind === 'in-use') {
    inUse.value = outcome.products
  }
}

async function add(): Promise<void> {
  busy.value = true
  inUse.value = undefined

  // Typed as a percentage, held in basis points, the way a price is typed in
  // euros and held in cents.
  const typed = Number(percent.value.trim().replace(',', '.'))
  const basisPoints = Number.isFinite(typed) && percent.value.trim() !== ''
    ? Math.round(typed * 100)
    : undefined

  const outcome = await addRate({ name: name.value, basisPoints })
  apply(outcome)

  if (outcome.kind === 'listed') {
    name.value = ''
    percent.value = ''
  }

  busy.value = false
}

async function remove(rate: VatRate): Promise<void> {
  busy.value = true
  apply(await removeRate(rate.id))
  busy.value = false
}

async function promote(rate: VatRate): Promise<void> {
  busy.value = true
  apply(await makeDefault(rate.id))
  busy.value = false
}

onMounted(async () => apply(await listRates()))
</script>

<template>
  <div class="rates">
    <!-- The empty sentence is the table's own empty state, so nothing here
         decides between a table and a sentence. -->
    <VatRateTable
      :rates="sorted"
      :busy="busy"
      @promote="promote"
      @remove="remove"
    />

    <!-- The shop sends the count; the sentence is written here, where the
         reader's language is known and one product is not "1 products". -->
    <Alert v-if="inUse !== undefined">
      {{ t('settings.rates.inUse', { count: inUse }, inUse) }}
    </Alert>

    <div class="add">
      <TextField
        v-model="name"
        :label="t('settings.rates.name')"
        :error="errors.name"
      />
      <TextField
        v-model="percent"
        class="narrow"
        :label="t('settings.rates.rate')"
        suffix="%"
        :error="errors.basisPoints"
      />
      <Button
        variant="quiet"
        :busy="busy"
        @click="add"
      >
        {{ t('settings.rates.add') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.rates {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

table {
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  color: var(--colour-text);
  vertical-align: middle;
}








/* The row that adds one, at the foot of the list rather than on a screen of
   its own to leave and come back from. */
.add {
  display: flex;
  gap: var(--space-3);
  align-items: start;
  margin-top: var(--space-2);
}

.add > :first-child {
  flex: 1;
}

.add .narrow {
  flex: 0 0 7rem;
}

.add > :last-child {
  margin-top: var(--space-2);
}

/* Three controls side by side need more than a phone has: below the threshold
   they stack, the way every other pair in the back office does. Left in a row,
   the rate field lands on top of the button and nothing can be added at all. */
@media (max-width: 47.999rem) {
  .add {
    flex-direction: column;
    align-items: stretch;
  }

  .add .narrow {
    flex: 1;
  }

  .add > :last-child {
    align-self: start;
    margin-top: 0;
  }
}
</style>
