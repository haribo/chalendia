<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import FieldFrame from '@/shared/ui/FieldFrame.vue'
import { useFormSubmitting } from '@/shared/ui/form-state'

export interface SelectOption {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    label: string
    options: readonly SelectOption[]
    /** Only when it says something the chosen value does not already show. */
    error?: string
    disabled?: boolean
    /**
     * A picker in a bar carries no frame: it sits among other controls, not in
     * a form, and a notched border there is chrome for nothing.
     */
    bare?: boolean
  }>(),
  { error: undefined, disabled: false, bare: false },
)

const model = defineModel<string>({ required: true })
const id = useId()
const focused = ref(false)

const submitting = useFormSubmitting()
const locked = computed(() => props.disabled || submitting.value)
const invalid = computed(() => props.error !== undefined)

function onChange(event: Event): void {
  model.value = (event.target as HTMLSelectElement).value
}
</script>

<template>
  <!-- A select always has a value, so its label never rests inside the control. -->
  <FieldFrame
    v-if="!bare"
    :label="label"
    :control-id="id"
    floating
    :invalid="invalid"
    :disabled="locked"
    :error="error"
  >
    <select
      :id="id"
      :value="model"
      :disabled="locked"
      :aria-invalid="invalid || undefined"
      @change="onChange"
      @focus="focused = true"
      @blur="focused = false"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </FieldFrame>

  <label
    v-else
    :for="id"
    class="bare"
  >
    <span class="hidden">{{ label }}</span>
    <select
      :id="id"
      :value="model"
      :disabled="locked"
      @change="onChange"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
/* Inside a frame the control is naked: the frame draws the border. */
select {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--colour-text);
  font: inherit;
  font-size: var(--text-m);
  cursor: pointer;
}

select:focus {
  outline: none;
}

.bare {
  display: inline-flex;
}

.bare select {
  appearance: none;
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  background: var(--colour-surface);
  color: var(--colour-text-muted);
  font-size: var(--text-s);
}

.hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
