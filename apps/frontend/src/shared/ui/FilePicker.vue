<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/shared/ui/Button.vue'

/**
 * Choosing files, without the browser's bare input.
 *
 * A file input renders differently in every browser, carries a label nobody
 * wrote, and cannot be styled — so the real one is hidden and a `Button` opens
 * it. The input stays in the DOM rather than being created on demand: a picker
 * opened from a synthetic click outside a user gesture is blocked, and the
 * gesture here is the button's own.
 */
withDefaults(
  defineProps<{
    /** What the button says. Always words: there is no icon for "choose". */
    label: string
    /** Passed straight to the input — the browser's own filter, not a promise. */
    accept?: string
    multiple?: boolean
    disabled?: boolean
    variant?: 'primary' | 'quiet'
  }>(),
  { accept: undefined, multiple: false, disabled: false, variant: 'primary' },
)

const emit = defineEmits<{ picked: [File[]] }>()

const input = ref<HTMLInputElement>()

function chosen(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    emit('picked', Array.from(target.files))
  }

  // Cleared so choosing the same file twice in a row still raises an event:
  // a merchant who fixed a photograph and picked it again expects it to go.
  target.value = ''
}
</script>

<template>
  <span class="picker">
    <input
      ref="input"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      tabindex="-1"
      aria-hidden="true"
      @change="chosen"
    >
    <Button
      :variant="variant"
      :disabled="disabled"
      @click="input?.click()"
    >
      {{ label }}
    </Button>
  </span>
</template>

<style scoped>
.picker {
  display: inline-flex;
}

/* Out of the layout and out of the tab order, but still in the DOM: `display:
   none` would make it unclickable in some browsers, which is the one thing it
   has to be. */
input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
