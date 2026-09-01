<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from '@/shared/ui/Button.vue'
import Form from '@/shared/ui/Form.vue'
import IconLock from '@/shared/ui/icons/IconLock.vue'
import IconMail from '@/shared/ui/icons/IconMail.vue'
import LanguagePicker from '@/shared/ui/LanguagePicker.vue'
import PasswordField from '@/shared/ui/PasswordField.vue'
import TextField from '@/shared/ui/TextField.vue'
import ThemePicker from '@/shared/ui/ThemePicker.vue'
import { signIn } from '@/shared/api/session'
import { PRODUCT_NAME } from '@/shared/shop'
import { useSessionStore } from '@/stores/session'
import { useShopStore } from '@/stores/shop'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const shop = useShopStore()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const refused = ref(false)

// The shop's own name: the operator signs in to their shop, not to the product.
const title = computed(() => shop.name ?? PRODUCT_NAME)

/** Where the visitor was going before the guard sent them here. */
const intended = computed(() => {
  const target = route.query.next
  return typeof target === 'string' && target.startsWith('/') ? target : '/admin'
})

async function submit(): Promise<void> {
  submitting.value = true
  refused.value = false

  const outcome = await signIn(email.value, password.value)
  if (outcome === 'signed-in') {
    await session.refresh()
    // Back to the page that was asked for, not to a default dashboard.
    await router.replace(intended.value)
  } else {
    refused.value = true
  }

  submitting.value = false
}
</script>

<template>
  <main class="sign-in">
    <header class="bar">
      <p class="brand">
        {{ title }}
      </p>
      <div class="controls">
        <LanguagePicker bare />
        <ThemePicker bare />
      </div>
    </header>

    <h1>{{ t('signIn.title') }}</h1>

    <!-- Above the form, not on a field: the shop does not say which half is
         wrong, and marking one field would say it in its place. -->
    <p
      v-if="refused"
      class="refused"
      role="alert"
    >
      {{ t('signIn.refused') }}
    </p>

    <Form
      :submitting="submitting"
      @submit="submit"
    >
      <TextField
        v-model="email"
        type="email"
        autocomplete="username"
        :icon="IconMail"
        :label="t('signIn.email')"
      />
      <PasswordField
        v-model="password"
        autocomplete="current-password"
        :icon="IconLock"
        :label="t('signIn.password')"
        :strength="false"
      />

      <template #actions>
        <Button
          type="submit"
          variant="primary"
          :busy="submitting"
        >
          {{ submitting ? t('signIn.signingIn') : t('signIn.action') }}
        </Button>
      </template>
    </Form>

    <RouterLink
      v-if="!submitting"
      class="back"
      to="/"
    >
      {{ t('signIn.backToShop') }}
    </RouterLink>
  </main>
</template>

<style scoped>
.sign-in {
  max-width: 24rem;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.brand {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: var(--text-l);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.controls {
  display: flex;
  flex: none;
  gap: var(--space-2);
}

h1 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-display);
  font-size: var(--text-l);
  font-weight: 600;
}

.refused {
  margin: 0 0 var(--space-4);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--colour-danger);
  border-left-width: 3px;
  border-radius: var(--radius-1);
  color: var(--colour-danger);
  font-size: var(--text-s);
  font-weight: 600;
}

.back {
  display: inline-block;
  margin-top: var(--space-6);
  color: var(--colour-accent);
  font-size: var(--text-s);
}
</style>
