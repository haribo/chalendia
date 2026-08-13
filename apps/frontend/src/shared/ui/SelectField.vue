<script setup lang="ts">
import { useId } from 'vue'

export interface SelectOption {
  value: string
  label: string
}

defineProps<{
  /** Read by assistive technology; not shown, the options speak for themselves. */
  label: string
  options: readonly SelectOption[]
}>()

const model = defineModel<string>({ required: true })
const id = useId()

function onChange(event: Event): void {
  model.value = (event.target as HTMLSelectElement).value
}
</script>

<template>
  <!-- Both wrapped and associated by id: either alone leaves some assistive
       technology without the label. -->
  <label
    :for="id"
    class="field"
  >
    <span class="label">{{ label }}</span>
    <select
      :id="id"
      :value="model"
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
.field {
  display: inline-flex;
}

select {
  appearance: none;
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  background: var(--colour-surface);
  color: var(--colour-text-muted);
  font: inherit;
  font-size: var(--text-s);
}

.label {
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
