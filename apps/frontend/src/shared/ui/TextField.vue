<script setup lang="ts">
import { computed, ref, useId, type Component } from 'vue'

import FieldFrame from '@/shared/ui/FieldFrame.vue'
import { useFormSubmitting } from '@/shared/ui/form-state'

const props = withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'email'
    optional?: boolean
    /** Shown under the field, before anything goes wrong. */
    hint?: string
    /** Only when it says something the value does not already show. */
    error?: string
    disabled?: boolean
    icon?: Component
    autocomplete?: string
    /** Several lines, for prose rather than a value. */
    multiline?: boolean
    /**
     * A fixed unit the value is expressed in — a currency, a weight. It sits
     * inside the frame because it belongs to the value, not to the label.
     */
    suffix?: string
  }>(),
  {
    type: 'text',
    optional: false,
    hint: undefined,
    error: undefined,
    disabled: false,
    icon: undefined,
    autocomplete: undefined,
    multiline: false,
    suffix: undefined,
  },
)

const model = defineModel<string>({ default: '' })
const id = useId()
const focused = ref(false)
const describedBy = computed(() =>
  [props.error ? `${id}-error` : undefined, props.hint ? `${id}-hint` : undefined]
    .filter(Boolean)
    .join(' ') || undefined,
)

const submitting = useFormSubmitting()
const locked = computed(() => props.disabled || submitting.value)
// An empty string is a refusal without words — the border says it to everyone
// who can see it, and `aria-invalid` says it to everyone who cannot. Only
// `undefined` means the field is fine.
const invalid = computed(() => props.error !== undefined)
</script>

<template>
  <div class="field">
    <FieldFrame
      :label="label"
      :control-id="id"
      :icon="icon"
      :floating="focused || model.length > 0"
      :optional="optional"
      :invalid="invalid"
      :disabled="locked"
      :error="error || undefined"
    >
      <textarea
        v-if="multiline"
        :id="id"
        v-model="model"
        rows="3"
        :disabled="locked"
        :required="!optional"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedBy"
        @focus="focused = true"
        @blur="focused = false"
      />
      <input
        v-else
        :id="id"
        v-model="model"
        :type="type"
        :disabled="locked"
        :required="!optional"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedBy"
        :autocomplete="autocomplete"
        @focus="focused = true"
        @blur="focused = false"
      >

      <!-- After the control, so a screen reader meets the value first and the
           unit second, the way it is read aloud. -->
      <span
        v-if="suffix"
        class="suffix"
        aria-hidden="true"
      >{{ suffix }}</span>
    </FieldFrame>

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

textarea {
  resize: vertical;
}

.suffix {
  flex: none;
  color: var(--colour-text-muted);
  font-size: var(--text-s);
  white-space: nowrap;
}

.hint {
  margin: var(--space-1) 0 0 var(--space-3);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
