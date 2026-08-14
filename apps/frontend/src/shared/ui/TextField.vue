<script setup lang="ts">
import { computed, ref, useId } from 'vue'

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
    autocomplete?: string
  }>(),
  {
    type: 'text',
    optional: false,
    hint: undefined,
    error: undefined,
    disabled: false,
    autocomplete: undefined,
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
      :floating="focused || model.length > 0"
      :optional="optional"
      :invalid="invalid"
      :disabled="locked"
      :error="error || undefined"
    >
      <input
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

.hint {
  margin: var(--space-1) 0 0 var(--space-3);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}
</style>
