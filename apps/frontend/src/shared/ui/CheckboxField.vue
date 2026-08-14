<script setup lang="ts">
import { computed, useId } from 'vue'

import { useFormSubmitting } from '@/shared/ui/form-state'

const props = withDefaults(defineProps<{ label: string; disabled?: boolean }>(), {
  disabled: false,
})

const model = defineModel<boolean>({ default: false })
const id = useId()
const submitting = useFormSubmitting()
const locked = computed(() => props.disabled || submitting.value)
</script>

<template>
  <!-- No frame and no notch: a checkbox carries its label beside it, where the
       answer is read, rather than above an empty box. -->
  <div class="field">
    <input
      :id="id"
      v-model="model"
      type="checkbox"
      :disabled="locked"
    >
    <label :for="id">{{ label }}</label>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

input {
  width: 0.9rem;
  height: 0.9rem;
  accent-color: var(--colour-accent);
  cursor: pointer;
}

input:disabled,
input:disabled + label {
  cursor: not-allowed;
  opacity: 0.6;
}

label {
  font-size: var(--text-m);
  cursor: pointer;
}
</style>
