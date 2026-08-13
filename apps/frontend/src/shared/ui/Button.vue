<script setup lang="ts">
withDefaults(
  defineProps<{
    /**
     * `quiet` is an outlined button for a secondary action. A filled variant
     * arrives with the first primary action the product actually has — a
     * variant nobody calls is a guess about a contract.
     */
    variant?: 'quiet'
    disabled?: boolean
  }>(),
  { variant: 'quiet', disabled: false },
)

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <!-- Always type="button": inside a form, the default is submit, and a retry
       button that submits the form is a bug nobody sees coming. -->
  <button
    type="button"
    :class="variant"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
button {
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  font: inherit;
  font-size: var(--text-s);
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.quiet {
  border: 1px solid var(--colour-accent);
  background: transparent;
  color: var(--colour-accent);
}

.quiet:hover:not(:disabled) {
  background: var(--colour-accent-quiet);
}
</style>
