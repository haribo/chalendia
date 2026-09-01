<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/shared/ui/Button.vue'
import IconClose from '@/shared/ui/icons/IconClose.vue'

const props = defineProps<{
  open: boolean
  /** Names the drawer for assistive technology, and titles it on screen. */
  label: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

const dialog = ref<HTMLDialogElement>()

/**
 * A modal dialog rather than a panel of our own: the browser holds the focus
 * inside it, closes it on Escape, and takes the page behind it out of the
 * accessibility tree — three behaviours that are wrong far more often when
 * they are hand-written.
 */
watch(
  () => props.open,
  (open) => {
    const element = dialog.value
    if (!element) return

    // The methods are optional here because the test environment does not
    // implement them; a browser always has them.
    if (open) element.showModal?.()
    else element.close?.()

    // A modal dialog still lets the page behind it scroll, which on a phone
    // reads as the drawer sliding away under the finger.
    document.body.classList.toggle('scroll-locked', open)
  },
)

/**
 * The backdrop belongs to the dialog, so a press on it reports the dialog
 * itself as the target — anything inside the panel reports the panel.
 *
 * Bound here rather than in the template: a click handler on a non-interactive
 * element is exactly what the accessibility lint exists to catch, and the
 * exception is the backdrop of a dialog the browser already made interactive.
 */
function onPress(event: MouseEvent): void {
  if (event.target === dialog.value) emit('close')
}

onMounted(() => dialog.value?.addEventListener('click', onPress))

onBeforeUnmount(() => {
  dialog.value?.removeEventListener('click', onPress)
  document.body.classList.remove('scroll-locked')
})
</script>

<template>
  <dialog
    ref="dialog"
    class="drawer"
    :aria-label="label"
    @close="emit('close')"
  >
    <!-- Only while it is open: a closed drawer that keeps its content in the
         document duplicates whatever the bar already shows, and both copies
         answer a search for it. -->
    <div
      v-if="open"
      class="panel"
    >
      <header class="head">
        <!-- On the side the drawer came from, where the finger already is
             rather than across the screen. -->
        <Button
          variant="icon"
          :aria-label="t('drawer.close')"
          @click="emit('close')"
        >
          <IconClose />
        </Button>
        <p class="title">
          {{ label }}
        </p>
      </header>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.drawer {
  width: min(17rem, 85vw);
  max-width: none;
  height: 100%;
  max-height: none;
  margin: 0 auto 0 0;
  padding: 0;
  border: 0;
  border-right: 1px solid var(--colour-border);
  background: var(--colour-surface-raised);
  color: var(--colour-text);
}

.drawer::backdrop {
  background: var(--colour-scrim);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  height: 100%;
  padding: var(--space-3) var(--space-3) var(--space-4);
  overflow-y: auto;
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 0 var(--space-2) var(--space-1);
}

.title {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-display);
  font-size: var(--text-l);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
