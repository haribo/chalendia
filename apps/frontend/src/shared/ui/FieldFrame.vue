<script setup lang="ts">
/**
 * The outlined frame every form control shares: a border the label sits in
 * once the field is active or filled.
 *
 * The `<fieldset>` is decorative and hidden from assistive technology; the
 * browser interrupts its border where the `<legend>` sits, and the legend
 * carries an invisible copy of the label to reserve exactly the right width.
 * The visible label is a single element that moves — never two labels swapped,
 * which would announce twice.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    label: string
    /** Wires the visible label to the control the caller renders. */
    controlId: string
    /** The label sits in the border once the field has focus or a value. */
    floating?: boolean
    /** Almost every field is required, so only the exceptions are marked. */
    optional?: boolean
    invalid?: boolean
    valid?: boolean
    disabled?: boolean
    busy?: boolean
    /**
     * Shown next to the label, and only when it adds something the value does
     * not already show: a truncated address or an empty required field needs
     * no words, "already taken" does.
     */
    error?: string
  }>(),
  {
    floating: false,
    optional: false,
    invalid: false,
    valid: false,
    disabled: false,
    busy: false,
    error: undefined,
  },
)

const { t } = useI18n()

// The notch has to be open whenever something is written in it.
const notched = computed(() => props.floating || Boolean(props.error))
</script>

<template>
  <div
    class="frame"
    :class="{
      notched,
      invalid,
      valid: valid && !invalid,
      disabled,
    }"
  >
    <fieldset
      class="decor"
      aria-hidden="true"
    >
      <legend class="notch">
        <span class="reserve">{{ label }}</span>
        <span
          v-if="error"
          class="reserve"
        >— {{ error }}</span>
        <span
          v-else-if="optional"
          class="reserve"
        >{{ t('forms.optional') }}</span>
      </legend>
    </fieldset>

    <!-- Label and message share a row but stay separate elements: folding the
         message into the label would change the control's accessible name every
         time it is refused, and a voice command asking for the field by name
         would stop finding it. -->
    <div class="row">
      <label
        :for="controlId"
        class="label"
      >{{ label }}</label>
      <span
        v-if="error"
        :id="`${controlId}-error`"
        class="message"
      >— {{ error }}</span>
      <span
        v-else-if="optional && notched"
        class="optional"
      >{{ t('forms.optional') }}</span>
    </div>

    <div class="control">
      <slot />

      <span
        v-if="optional && !notched"
        class="optional resting"
      >{{ t('forms.optional') }}</span>

      <slot name="trailing" />

      <span
        v-if="busy"
        class="spinner"
        aria-hidden="true"
      />
      <svg
        v-else-if="invalid"
        class="icon invalid-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle
          cx="10"
          cy="10"
          r="8"
        />
        <path d="M10 6v5" />
        <path d="M10 13.5v.5" />
      </svg>
      <svg
        v-else-if="valid"
        class="icon valid-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle
          cx="10"
          cy="10"
          r="8"
        />
        <path d="M6 10.5l2.5 2.5L14 7.5" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.frame {
  position: relative;
  /* The notch overhangs the top of the border, so a stack of fields needs
     this clearance or one label touches the frame above it. */
  margin-top: 0.4rem;
  color: var(--colour-text-muted);
}

.decor {
  position: absolute;
  inset: -0.55rem 0 0;
  margin: 0;
  padding: 0;
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-1);
  pointer-events: none;
}

.notch {
  max-width: 0;
  margin-left: 0.55rem;
  padding: 0;
  font-size: var(--text-s);
  line-height: 1;
  white-space: nowrap;
  transition: max-width 120ms ease;
}

.notched .notch {
  max-width: 100%;
  padding: 0 0.3rem;
}

/* Invisible, but it still reserves the width the border must skip. */
.reserve {
  visibility: hidden;
}

/* The row carries the movement; its children only sit side by side. */
.row {
  position: absolute;
  top: 50%;
  left: 0.75rem;
  display: flex;
  gap: 0.3rem;
  max-width: calc(100% - 3.5rem);
  overflow: hidden;
  font-size: var(--text-m);
  white-space: nowrap;
  transform: translateY(-50%);
  transition:
    top 120ms ease,
    font-size 120ms ease;
  pointer-events: none;
}

.notched .row {
  top: -0.55rem;
  left: 0.85rem;
  font-size: var(--text-s);
}

.label,
.message {
  overflow: hidden;
  text-overflow: ellipsis;
}

.label {
  color: var(--colour-text-muted);
}

.control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  min-height: 1.5rem;
}

.control :deep(input) {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--colour-text);
  font: inherit;
  font-size: var(--text-m);
}

.control :deep(input:focus) {
  outline: none;
}

/* Focus is drawn on the frame, so the ring follows the border rather than
   the bare input inside it. */
.frame:focus-within .decor {
  border-color: var(--colour-accent);
  border-width: 2px;
}

.frame:focus-within .label {
  color: var(--colour-accent);
}

.invalid .decor {
  border-color: var(--colour-danger);
  border-width: 2px;
}

.invalid .label,
.invalid .message,
.invalid .invalid-icon {
  color: var(--colour-danger);
}

.valid .decor {
  border-color: var(--colour-success);
}

.valid-icon {
  color: var(--colour-success);
}

.disabled {
  opacity: 0.55;
}

.disabled .control :deep(input) {
  color: var(--colour-text-muted);
}

.optional {
  font-style: italic;
  font-size: var(--text-s);
}

.optional.resting {
  flex: none;
  color: var(--colour-text-muted);
}


.icon {
  flex: none;
  width: 1rem;
  height: 1rem;
}

.spinner {
  flex: none;
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--colour-border);
  border-top-color: var(--colour-accent);
  border-radius: 50%;
  animation: spin 700ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
