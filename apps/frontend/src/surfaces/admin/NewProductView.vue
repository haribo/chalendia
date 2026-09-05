<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/shared/ui/Button.vue'
import CheckboxField from '@/shared/ui/CheckboxField.vue'
import Form from '@/shared/ui/Form.vue'
import IconBadge from '@/shared/ui/icons/IconBadge.vue'
import IconCatalogue from '@/shared/ui/icons/IconCatalogue.vue'
import IconContent from '@/shared/ui/icons/IconContent.vue'
import IconPayments from '@/shared/ui/icons/IconPayments.vue'
import IconReceipt from '@/shared/ui/icons/IconReceipt.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import SelectField from '@/shared/ui/SelectField.vue'
import TextField from '@/shared/ui/TextField.vue'
import { createProduct } from '@/shared/api/catalogue'
import { listRates, type VatRate } from '@/shared/api/tax'
import { formatAmount, formatRate, parseAmount, taxWithin } from '@/shared/money'
import { productErrorsFrom, type ProductErrors } from '@/surfaces/admin/catalogue-errors'
import { useShopStore } from '@/stores/shop'

const { t, locale } = useI18n()
const router = useRouter()
const shop = useShopStore()

const title = ref('')
const description = ref('')
const price = ref('')
const merchantReference = ref('')
const publish = ref(false)
const rates = ref<VatRate[]>([])
const vatRateId = ref('')

const rateOptions = computed(() =>
  rates.value.map((rate) => ({
    value: String(rate.id),
    label: `${rate.name} — ${formatRate(rate.basisPoints, locale.value)}`,
  })),
)

/**
 * The tax the typed price already contains. Derived, never asked: prices are
 * entered inclusive (`docs/design/core.md` § 6), and a merchant setting 6,90 €
 * wants to see what is left without opening a calculator.
 */
const included = computed(() => {
  const rate = rates.value.find((candidate) => String(candidate.id) === vatRateId.value)
  const minor = parseAmount(price.value, shop.currency ?? 'EUR', locale.value)
  if (!rate || minor === undefined || minor < 0 || !shop.currency) return undefined

  const { tax, net } = taxWithin(minor, rate.basisPoints)
  return t('catalogue.new.vatIncluded', {
    tax: formatAmount(tax, shop.currency, locale.value),
    net: formatAmount(net, shop.currency, locale.value),
  })
})

onMounted(async () => {
  if (!shop.vatEnabled) return

  const outcome = await listRates()
  if (outcome.kind !== 'listed') return

  rates.value = outcome.rates
  // The shop default, so a merchant with one rate never touches this field.
  vatRateId.value = String(outcome.rates.find((rate) => rate.isDefault)?.id ?? '')
})

const submitting = ref(false)
const unreachable = ref(false)
const errors = ref<ProductErrors>({})

async function submit(): Promise<void> {
  submitting.value = true
  unreachable.value = false
  errors.value = {}

  // Typed in major units, held in minor ones. An amount nobody can read is
  // sent as the nothing it is: the shop refuses it with every other field in
  // one answer, rather than this form refusing it on its own first (#56).
  const minor = parseAmount(price.value, shop.currency ?? 'EUR', locale.value)

  const outcome = await createProduct({
    title: title.value,
    description: description.value || undefined,
    price: minor,
    merchantReference: merchantReference.value || undefined,
    state: publish.value ? 'published' : 'draft',
    vatRateId: vatRateId.value ? Number(vatRateId.value) : undefined,
  })

  if (outcome.kind === 'listed') {
    // Back to the list, where the new product leads: a confirmation page would
    // only be something else to leave.
    await router.push('/admin/catalogue')
  } else if (outcome.kind === 'refused') {
    errors.value = productErrorsFrom(outcome.params)
  } else {
    unreachable.value = true
  }

  submitting.value = false
}
</script>

<template>
  <section class="new-product">
    <PageTitle>{{ t('catalogue.new.title') }}</PageTitle>

    <p
      v-if="unreachable"
      class="unreachable"
      role="alert"
    >
      {{ t('catalogue.unreachable') }}
    </p>

    <!-- No summary line above the fields: a refused field shows its own
         problem, and a line repeating it says nothing new. -->
    <Form
      :submitting="submitting"
      @submit="submit"
    >
      <TextField
        v-model="title"
        :icon="IconCatalogue"
        :label="t('catalogue.new.name')"
        :error="errors.title"
      />
      <TextField
        v-model="description"
        multiline
        optional
        :icon="IconContent"
        :label="t('catalogue.new.description')"
      />
      <TextField
        v-model="price"
        :icon="IconPayments"
        :label="t('catalogue.new.price')"
        :suffix="t('catalogue.new.priceSuffix')"
        :error="errors.price"
      />
      <p
        v-if="included"
        class="included"
      >
        {{ included }}
      </p>
      <SelectField
        v-if="rateOptions.length > 0"
        v-model="vatRateId"
        :icon="IconReceipt"
        :label="t('catalogue.new.vatRate')"
        :options="rateOptions"
      />
      <TextField
        v-model="merchantReference"
        optional
        :icon="IconBadge"
        :label="t('catalogue.new.reference')"
      />

      <template #actions>
        <!-- Beside the button, because it decides what the button does. -->
        <CheckboxField
          v-model="publish"
          :label="t('catalogue.new.publish')"
        />
        <Button
          type="submit"
          variant="primary"
          :busy="submitting"
        >
          {{ submitting ? t('catalogue.new.creating') : t('catalogue.new.create') }}
        </Button>
      </template>
    </Form>
  </section>
</template>

<style scoped>
.new-product {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 34rem;
}

.included {
  /* No negative margin: pulling this line up pulls the next field with it, and
     its notched legend lands outside its own frame. */
  margin: 0 0 0 var(--space-3);
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
</style>
