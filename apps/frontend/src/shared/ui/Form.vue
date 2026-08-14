<script setup lang="ts">
import { toRef } from 'vue'

import { provideFormSubmitting } from '@/shared/ui/form-state'

const props = withDefaults(defineProps<{ submitting?: boolean }>(), { submitting: false })

const emit = defineEmits<{ submit: [] }>()

// Every field inside locks itself while the request is away, rather than each
// caller remembering to pass `disabled` down.
provideFormSubmitting(toRef(props, 'submitting'))
</script>

<template>
  <form
    novalidate
    @submit.prevent="emit('submit')"
  >
    <div class="fields">
      <slot />
    </div>

    <div class="actions">
      <slot name="actions" />
    </div>
  </form>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.actions {
  /* At the end of the form, where the eye lands after the last field. */
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-6);
}
</style>
