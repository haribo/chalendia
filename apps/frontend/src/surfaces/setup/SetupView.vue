<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Button from '@/shared/ui/Button.vue'
import IconBadge from '@/shared/ui/icons/IconBadge.vue'
import IconGlobe from '@/shared/ui/icons/IconGlobe.vue'
import IconLock from '@/shared/ui/icons/IconLock.vue'
import IconMail from '@/shared/ui/icons/IconMail.vue'
import IconPayments from '@/shared/ui/icons/IconPayments.vue'
import IconPlace from '@/shared/ui/icons/IconPlace.vue'
import IconReceipt from '@/shared/ui/icons/IconReceipt.vue'
import IconSchedule from '@/shared/ui/icons/IconSchedule.vue'
import IconStorefront from '@/shared/ui/icons/IconStorefront.vue'
import CheckboxField from '@/shared/ui/CheckboxField.vue'
import Form from '@/shared/ui/Form.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import PasswordField from '@/shared/ui/PasswordField.vue'
import SelectField from '@/shared/ui/SelectField.vue'
import TextField from '@/shared/ui/TextField.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { runSetup } from '@/shared/api/setup'
import { PRODUCT_NAME } from '@/shared/shop'
import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'
import { countryOptions } from '@/shared/countries'
import { fieldErrorsFrom, type FieldErrors } from './setup-errors'

const { t, locale } = useI18n()
const router = useRouter()
const shop = useShopStore()
const session = useSessionStore()

const name = ref('')
const legalIdentity = ref('')
const country = ref('FR')
const currency = ref('EUR')
// Proposed by the browser rather than by a default nobody chose.
const timezone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
const contentLanguage = ref(navigator.language?.split('-')[0] ?? 'en')
const vatEnabled = ref(true)
const administratorEmail = ref('')
const administratorPassword = ref('')

const submitting = ref(false)
const errors = ref<FieldErrors>({})

/**
 * The shop names a weakness; the sentence is written here, where the reader's
 * language is known. An empty string is a refusal without words — the length
 * shows its own problem (#71).
 */
const passwordProblem = computed(() => {
  const named = errors.value.administratorPassword
  if (named === undefined || named === '') return named

  return t(`forms.weakness.${named}`)
})

// Named and sorted per interface language; the shop holds the code.
const countries = computed(() => countryOptions(locale.value))

const currencies = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'CHF', label: 'CHF — Franc suisse' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'CAD', label: 'CAD — Dollar canadien' },
]

const timezones = computed(() => {
  const supported = Intl.supportedValuesOf?.('timeZone') ?? [timezone.value]
  return supported.map((zone) => ({ value: zone, label: zone }))
})

const languages = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

async function submit(): Promise<void> {
  submitting.value = true
  errors.value = {}

  const outcome = await runSetup({
    name: name.value,
    legalIdentity: legalIdentity.value,
    country: country.value,
    currency: currency.value,
    contentLanguage: contentLanguage.value,
    timezone: timezone.value,
    vatEnabled: vatEnabled.value,
    administratorEmail: administratorEmail.value,
    administratorPassword: administratorPassword.value,
  })

  submitting.value = false

  switch (outcome.kind) {
    case 'configured':
      shop.markConfigured(outcome.name, outcome.currency)
      // The response carried a session; the interface only learns of it by
      // asking, and the guard would otherwise turn the administrator away.
      await session.refresh()
      await router.push('/admin')
      break
    case 'already-configured':
      shop.markConfigured()
      break
    case 'refused':
      errors.value = fieldErrorsFrom(outcome.params)
      break
    case 'unreachable':
      errors.value = {}
      break
  }
}
</script>

<template>
  <main class="setup">
    <header class="bar">
      <p class="brand">
        {{ PRODUCT_NAME }}
      </p>
      <div class="controls">
        <LanguagePicker bare />
        <ThemePicker bare />
      </div>
    </header>

    <section
      v-if="shop.configured"
      class="closed"
    >
      <h1>{{ t('setup.closed.title') }}</h1>
      <p>{{ t('setup.closed.signIn') }}</p>
      <Button
        variant="primary"
        @click="router.push('/admin')"
      >
        {{ t('setup.closed.action') }}
      </Button>
    </section>

    <Form
      v-else
      :submitting="submitting"
      @submit="submit"
    >
      <fieldset class="group">
        <legend class="text-label">
          {{ t('setup.groups.shop') }}
        </legend>
        <TextField
          v-model="name"
          :icon="IconStorefront"
          :label="t('setup.fields.name')"
          :error="errors.name"
        />
        <TextField
          v-model="legalIdentity"
          :icon="IconBadge"
          :label="t('setup.fields.legalIdentity')"
          :error="errors.legalIdentity"
        />
      </fieldset>

      <fieldset class="group">
        <legend class="text-label">
          {{ t('setup.groups.locale') }}
        </legend>
        <!-- The country leads the group: the currency, the timezone and the
             VAT rates that follow all hang off where the shop is. -->
        <div class="two">
          <div>
            <SelectField
              v-model="country"
              :icon="IconPlace"
              :label="t('setup.fields.country')"
              :options="countries"
              :error="errors.country"
            />
            <p class="hint">
              {{ t('setup.fields.countryDecides') }}
            </p>
          </div>
          <div>
            <SelectField
              v-model="currency"
              :icon="IconPayments"
              :label="t('setup.fields.currency')"
              :options="currencies"
            />
            <p class="hint">
              {{ t('setup.fields.currencyFinal') }}
            </p>
          </div>
        </div>
        <div class="two">
          <SelectField
            v-model="timezone"
            :icon="IconSchedule"
            :label="t('setup.fields.timezone')"
            :options="timezones"
          />
          <SelectField
            v-model="contentLanguage"
            :icon="IconGlobe"
            :label="t('setup.fields.contentLanguage')"
            :options="languages"
          />
        </div>
      </fieldset>

      <fieldset class="group">
        <legend class="text-label">
          {{ t('setup.groups.tax') }}
        </legend>
        <CheckboxField
          v-model="vatEnabled"
          :icon="IconReceipt"
          :label="t('setup.fields.vatEnabled')"
        />
      </fieldset>

      <fieldset class="group">
        <legend class="text-label">
          {{ t('setup.groups.account') }}
        </legend>
        <TextField
          v-model="administratorEmail"
          type="email"
          autocomplete="username"
          :icon="IconMail"
          :label="t('setup.fields.administratorEmail')"
          :error="errors.administratorEmail"
        />
        <PasswordField
          v-model="administratorPassword"
          :icon="IconLock"
          :label="t('setup.fields.administratorPassword')"
          :error="passwordProblem"
        />
      </fieldset>

      <template #actions>
        <Button
          type="submit"
          variant="primary"
          :busy="submitting"
        >
          {{ submitting ? t('setup.creating') : t('setup.create') }}
        </Button>
      </template>
    </Form>
  </main>
</template>

<style scoped>
.setup {
  max-width: 34rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4) var(--space-8);
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.brand {
  flex: 1;
  margin: 0;
  font: var(--style-title);
}

.controls {
  display: flex;
  flex: none;
  gap: var(--space-2);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  border: 0;
}

.group legend {
  width: 100%;
  padding: 0 0 var(--space-1);
  border-bottom: 1px solid var(--colour-border);
  color: var(--colour-text-muted);
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  /* Aligned on the frames: a hint under one field must not push the other. */
  align-items: start;
}

@media (max-width: 30rem) {
  .two {
    grid-template-columns: 1fr;
  }
}

.hint {
  margin: var(--space-1) 0 0 var(--space-3);
  color: var(--colour-text-muted);
  font: var(--style-caption);
}

.closed {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-8) 0;
}

.closed h1 {
  margin: 0;
  font: var(--style-heading);
}

.closed p {
  margin: 0;
  color: var(--colour-text-muted);
  font: var(--style-caption);
}
</style>
