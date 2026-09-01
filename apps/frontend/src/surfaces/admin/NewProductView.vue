<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/shared/ui/Button.vue'
import CheckboxField from '@/shared/ui/CheckboxField.vue'
import Form from '@/shared/ui/Form.vue'
import IconBadge from '@/shared/ui/icons/IconBadge.vue'
import IconCatalogue from '@/shared/ui/icons/IconCatalogue.vue'
import IconContent from '@/shared/ui/icons/IconContent.vue'
import IconPayments from '@/shared/ui/icons/IconPayments.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import TextField from '@/shared/ui/TextField.vue'
import { createProduct } from '@/shared/api/catalogue'
import { parseAmount } from '@/shared/money'
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

const submitting = ref(false)
const unreachable = ref(false)
const errors = ref<ProductErrors>({})

async function submit(): Promise<void> {
  submitting.value = true
  unreachable.value = false
  errors.value = {}

  // Typed in major units, held in minor ones.
  const minor = parseAmount(price.value, shop.currency ?? 'EUR', locale.value)

  // An amount that is not a number cannot be put in the request at all: the
  // contract carries an integer. The field is marked here rather than sending
  // something the shop would have to guess at, and the value shows the problem
  // itself, so it is marked without words.
  //
  // The cost is that the other fields are then refused on the next attempt
  // rather than with this one — see the issue linked from the pull request.
  if (minor === undefined) {
    errors.value = { price: '' }
    submitting.value = false
    return
  }

  const outcome = await createProduct({
    title: title.value,
    description: description.value || undefined,
    price: minor,
    merchantReference: merchantReference.value || undefined,
    state: publish.value ? 'published' : 'draft',
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
</style>
