<script setup lang="ts">
import { computed, ref, useId, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import FieldFrame from '@/shared/ui/FieldFrame.vue'
import IconEye from '@/shared/ui/icons/IconEye.vue'
import IconEyeOff from '@/shared/ui/icons/IconEyeOff.vue'
import { useFormSubmitting } from '@/shared/ui/form-state'

const props = withDefaults(
  defineProps<{
    label: string
    hint?: string
    error?: string
    disabled?: boolean
    icon?: Component
    autocomplete?: string
    /** Drawn as a strength bar; the field never blocks on it. */
    minimumLength?: number
    /** Off when signing in: one types an existing password, does not choose one. */
    strength?: boolean
  }>(),
  {
    hint: undefined,
    error: undefined,
    disabled: false,
    icon: undefined,
    autocomplete: 'new-password',
    minimumLength: 12,
    strength: true,
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

/**
 * A deliberately conservative estimate, in four steps.
 *
 * Length alone used to fill the bar, so twelve identical letters looked strong
 * while the shop refuses them. This never reaches the top without length *and*
 * variety, so it does not promise what the server would turn down — the real
 * verdict is the server's, and this only has to avoid contradicting it (#71).
 */
const filledSteps = computed(() => {
  const value = model.value
  if (value.length === 0) return 0
  if (value.length < props.minimumLength) return 1

  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((kind) =>
    kind.test(value),
  ).length
  const distinct = new Set(value).size

  // Long and varied, or very long: two ways to reach the top, since a
  // passphrase of lowercase words is stronger than a short mixed string.
  if (value.length >= props.minimumLength * 2 || (classes >= 3 && distinct >= 10)) return 4
  if (classes >= 2 || distinct >= 8) return 3

  return 2
})

/** What the bar says to someone who cannot see it. */
const strengthLabel = computed(() =>
  t(`forms.password.strength.${['empty', 'weak', 'fair', 'good', 'strong'][filledSteps.value]}`),
)
</script>

<template>
  <div class="field">
    <FieldFrame
      :label="label"
      :control-id="id"
      :icon="icon"
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
          :aria-label="revealed ? t('forms.password.hide') : t('forms.password.show')"
          @click="revealed = !revealed"
        >
          <IconEyeOff v-if="revealed" />
          <IconEye v-else />
        </button>
      </template>
    </FieldFrame>

    <!-- Named, not merely coloured: four green segments carry nothing to
         someone who cannot tell them apart, and nothing at all to a screen
         reader (WCAG 1.4.1). -->
    <!-- Once the shop has refused it, the bar says so too. A local estimate
         cannot see everything a dictionary does — motdepasse123 is long and
         varied and still guessed — so when the verdict arrives, the bar stops
         claiming otherwise rather than sitting green under a refusal. -->
    <div
      v-if="strength"
      class="strength"
      :class="{ refused: invalid }"
      role="img"
      :aria-label="invalid ? t('forms.password.strength.refused') : strengthLabel"
    >
      <span
        v-for="step in 4"
        :key="step"
        :class="{ reached: step <= filledSteps }"
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
  display: inline-flex;
  align-items: center;
  flex: none;
  border: 0;
  background: transparent;
  /* Muted, not accented: revealing a password is a convenience beside the
     value, never the action the screen exists for. */
  color: var(--colour-text-muted);
  font: inherit;
  cursor: pointer;
}

.reveal:hover {
  color: var(--colour-text);
}

.reveal:disabled {
  cursor: not-allowed;
}

.strength {
  display: flex;
  gap: var(--space-1);
  margin: var(--space-1) 0 0 var(--space-3);
}

.strength.refused span.reached {
  background: var(--colour-danger);
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
