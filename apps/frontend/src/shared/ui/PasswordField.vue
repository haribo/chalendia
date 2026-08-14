<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import FieldFrame from '@/shared/ui/FieldFrame.vue'
import { useFormSubmitting } from '@/shared/ui/form-state'

const props = withDefaults(
  defineProps<{
    label: string
    hint?: string
    error?: string
    disabled?: boolean
    autocomplete?: string
    /** Drawn as a strength bar; the field never blocks on it. */
    minimumLength?: number
  }>(),
  {
    hint: undefined,
    error: undefined,
    disabled: false,
    autocomplete: 'new-password',
    minimumLength: 12,
  },
)

const model = defineModel<string>({ default: '' })
const { t } = useI18n()
const id = useId()
const focused = ref(false)

const revealed = ref(false)
const submitting = useFormSubmitting()
const locked = computed(() => props.disabled || submitting.value)
const invalid = computed(() => props.error !== undefined)
const describedBy = computed(() =>
  [props.error ? `${id}-error` : undefined, props.hint ? `${id}-hint` : undefined]
    .filter(Boolean)
    .join(' ') || undefined,
)

/** Four steps, reached at a quarter of the minimum each. */
const strength = computed(() => {
  const step = props.minimumLength / 4
  return Math.min(4, Math.floor(model.value.length / step))
})
</script>

<template>
  <div class="field">
    <FieldFrame
      :label="label"
      :control-id="id"
      :floating="focused || model.length > 0"
      :invalid="invalid"
      :disabled="locked"
      :error="error"
    >
      <input
        :id="id"
        v-model="model"
        :type="revealed ? 'text' : 'password'"
        :disabled="locked"
        required
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedBy"
        :autocomplete="autocomplete"
        @focus="focused = true"
        @blur="focused = false"
      >

      <template #trailing>
        <!-- Offered, never imposed: creating an account blind is the best way
             to mistype the same thing twice. -->
        <button
          type="button"
          class="reveal"
          :disabled="locked"
          @click="revealed = !revealed"
        >
          {{ revealed ? t('forms.password.hide') : t('forms.password.show') }}
        </button>
      </template>
    </FieldFrame>

    <div
      class="strength"
      role="presentation"
    >
      <span
        v-for="step in 4"
        :key="step"
        :class="{ reached: step <= strength }"
      />
    </div>

    <p
      v-if="hint"
      :id="`${id}-hint`"
      class="hint"
    >
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
}

.reveal {
  flex: none;
  border: 0;
  background: transparent;
  color: var(--colour-accent);
  font: inherit;
  font-size: var(--text-s);
  font-weight: 600;
  cursor: pointer;
}

.reveal:disabled {
  cursor: not-allowed;
}

.strength {
  display: flex;
  gap: var(--space-1);
  margin: var(--space-1) 0 0 var(--space-3);
}

.strength span {
  width: 1.6rem;
  height: 0.2rem;
  border-radius: 2px;
  background: var(--colour-border);
}

.strength span.reached {
  background: var(--colour-success);
}

.hint {
  margin: var(--space-1) 0 0 var(--space-3);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
