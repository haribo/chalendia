<script setup lang="ts">
withDefaults(
  defineProps<{
    /**
     * `primary` is the filled variant — one per screen, on the action the
     * screen exists for. `quiet` is outlined, for everything beside it.
     * `link` looks like a link and stays a button: signing out is an action,
     * not a navigation, and a link would offer to open it in a new tab.
     */
    variant?: 'primary' | 'quiet' | 'link'
    type?: 'button' | 'submit'
    disabled?: boolean
    /** Says what is happening rather than spinning in silence. */
    busy?: boolean
  }>(),
  { variant: 'quiet', type: 'button', disabled: false, busy: false },
)

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <!-- Explicit type: inside a form the default is submit, and a retry button
       that submits the form is a bug nobody sees coming. -->
  <button
    :type="type"
    :class="[variant, { busy }]"
    :disabled="disabled || busy"
    @click="$emit('click', $event)"
  >
    <span
      v-if="busy"
      class="spinner"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>

<style scoped>
button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-4);
  font: inherit;
  font-size: var(--text-s);
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.primary {
  background: var(--colour-accent);
  color: var(--colour-on-accent);
}

.quiet {
  border-color: var(--colour-accent);
  background: transparent;
  color: var(--colour-accent);
}

.quiet:hover:not(:disabled) {
  background: var(--colour-accent-quiet);
}

.link {
  padding: 0;
  background: transparent;
  color: var(--colour-accent);
  white-space: nowrap;
}

.link:hover:not(:disabled),
.link:focus-visible {
  text-decoration: underline;
}

.spinner {
  width: 0.8rem;
  height: 0.8rem;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
