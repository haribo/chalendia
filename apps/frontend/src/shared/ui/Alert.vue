<script setup lang="ts">
import { computed } from 'vue'

import IconCheckCircle from '@/shared/ui/icons/IconCheckCircle.vue'
import IconError from '@/shared/ui/icons/IconError.vue'
import IconWarning from '@/shared/ui/icons/IconWarning.vue'

/**
 * What the shop has to say about something that just happened.
 *
 * Four surfaces wrote their own before this existed, under three class names,
 * and two had already drifted — one had lost the weight of the others, and each
 * carried its own margin. That is the trajectory frontend ADR 0003 § 3 predicts
 * from the second copy on.
 *
 * Unlike a pill, the icon **is** derived here: a tone names the kind of news,
 * and the news of one kind always looks the same. Three tones, three icons.
 *
 * `role="alert"` is carried by the component, so the next screen cannot forget
 * it — which is what the four hand-written ones each had to remember.
 */
const props = withDefaults(
  defineProps<{ tone?: 'danger' | 'warning' | 'success' }>(),
  { tone: 'danger' },
)

const icon = computed(
  () => ({ danger: IconError, warning: IconWarning, success: IconCheckCircle })[props.tone],
)
</script>

<template>
  <p
    class="alert"
    :class="tone"
    role="alert"
  >
    <component
      :is="icon"
      class="icon"
    />
    <span class="body"><slot /></span>
  </p>
</template>

<style scoped>
.alert {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid currentColor;
  /* Thicker on the side the eye starts from, so a wall of text still shows
     where the message begins. */
  border-left-width: 3px;
  border-radius: var(--radius-1);
  font: var(--style-caption-strong);
}

.danger {
  color: var(--colour-danger);
}

.warning {
  color: var(--colour-warning);
}

.success {
  color: var(--colour-success);
}

.icon {
  flex: none;
  /* Aligned with the first line of text rather than with the box. */
  margin-top: 0.1rem;
}

.body {
  min-width: 0;
}
</style>
