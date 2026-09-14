<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ProductImage } from '@/shared/api/images'
import Button from '@/shared/ui/Button.vue'
import IconChevronLeft from '@/shared/ui/icons/IconChevronLeft.vue'
import IconChevronRight from '@/shared/ui/icons/IconChevronRight.vue'
import IconError from '@/shared/ui/icons/IconError.vue'
import IconHourglass from '@/shared/ui/icons/IconHourglass.vue'
import IconRefresh from '@/shared/ui/icons/IconRefresh.vue'
import IconTrash from '@/shared/ui/icons/IconTrash.vue'
import TextField from '@/shared/ui/TextField.vue'

/**
 * One photograph of a product, as the back office shows it
 * (`docs/design/catalog.md` § 5, *In the back office*).
 *
 * Everything that acts on a photograph is laid on the photograph itself: the
 * rank and its two chevrons at the foot where a thumb reaches, the state at the
 * top-left, removing and retrying at the top-right where a thumb does not. The
 * card is then the same two rows everywhere, so two neighbours cannot differ in
 * height because one carries an action the other does not.
 */
const props = defineProps<{
  image: ProductImage
  /** What the merchant reads, counted from one, not the stored position. */
  rank: number
  first: boolean
  last: boolean
  /**
   * An upload is in flight. Reordering sends the whole list and the shop
   * refuses a list that is not exactly what it holds, so a photograph landing
   * mid-gesture would make this page's list wrong through no fault of the
   * merchant's. Describing stays open: it changes one photograph, not the list.
   */
  locked: boolean
}>()

const emit = defineEmits<{
  moveBack: []
  moveForward: []
  remove: []
  retry: []
  describe: [string | null]
}>()

const { t } = useI18n()

const text = ref(props.image.alternativeText ?? '')
// The shop is the authority: a reorder answers with every image, and a stale
// field here would quietly overwrite a description the merchant fixed elsewhere.
watch(
  () => props.image.alternativeText,
  (fresh) => {
    text.value = fresh ?? ''
  },
)

/** The medium size: the card is about 200 px wide, and a dense screen doubles that. */
const shown = computed(() => `/media/images/${props.image.reference}`)

const state = computed(() => {
  if (props.image.state === 'failed') {
    return { icon: IconError, label: t('catalogue.photographs.failed') }
  }
  if (props.image.state === 'pending') {
    return { icon: IconHourglass, label: t('catalogue.photographs.preparing') }
  }

  return undefined
})

/**
 * Saved when the field is left rather than on every keystroke: the moment is
 * unambiguous for the merchant, and a description is written once.
 */
function saveIfChanged() {
  const written = text.value.trim()
  const held = props.image.alternativeText ?? ''
  if (written === held) {
    return
  }

  emit('describe', written === '' ? null : written)
}
</script>

<template>
  <div class="card">
    <span
      class="shot"
      :class="{ failed: image.state === 'failed' }"
    >
      <picture>
        <source
          :srcset="`${shown}/600.avif`"
          type="image/avif"
        >
        <img
          :src="`${shown}/600.jpg`"
          :alt="image.alternativeText ?? ''"
          loading="lazy"
          decoding="async"
        >
      </picture>

      <span
        v-if="state"
        class="badge"
        role="img"
        :aria-label="state.label"
      >
        <component
          :is="state.icon"
          size="sm"
        />
      </span>

      <span class="actions">
        <Button
          v-if="image.state === 'failed'"
          variant="on-image"
          :aria-label="t('catalogue.photographs.retry')"
          @click="emit('retry')"
        >
          <IconRefresh size="sm" />
        </Button>
        <Button
          variant="on-image"
          :disabled="locked"
          :aria-label="t('catalogue.photographs.remove')"
          @click="emit('remove')"
        >
          <IconTrash size="sm" />
        </Button>
      </span>

      <span class="ordering">
        <Button
          variant="on-image"
          :disabled="first || locked"
          :aria-label="t('catalogue.photographs.moveBack')"
          @click="emit('moveBack')"
        >
          <IconChevronLeft size="sm" />
        </Button>
        <!-- A digit, not an ordinal: on a photograph it reads as a position,
             and "1st" would cost room without adding anything. -->
        <span class="rank">{{ rank }}</span>
        <Button
          variant="on-image"
          :disabled="last || locked"
          :aria-label="t('catalogue.photographs.moveForward')"
          @click="emit('moveForward')"
        >
          <IconChevronRight size="sm" />
        </Button>
      </span>
    </span>

    <!-- Focusout rather than a keystroke timer: the merchant decides when they
         are done, and the field is not asked to guess. -->
    <div
      class="field"
      @focusout="saveIfChanged"
    >
      <TextField
        v-model="text"
        :label="t('catalogue.photographs.alternativeText')"
        optional
      />
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shot {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-2);
  background: var(--colour-surface-raised);
}

.shot.failed {
  border-color: var(--colour-danger);
}

img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  color: var(--ink-on-image);
}

/* The same outline the on-image buttons wear, for the same reason: a
   photograph takes any luminance, so what contrasts must be white against the
   dark halo rather than ink against the picture. */
.badge :deep(svg) {
  filter: drop-shadow(0 0 1px var(--outline-on-image))
    drop-shadow(0 0 1px var(--outline-on-image))
    drop-shadow(0 0 3px var(--outline-on-image-soft));
}

.actions {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
}

.ordering {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: flex;
  align-items: center;
  transform: translateX(-50%);
}

.rank {
  min-width: 1.1rem;
  color: var(--ink-on-image);
  font: var(--style-caption-strong);
  font-variant-numeric: tabular-nums;
  text-align: center;
  /* A text-shadow, not a filter: a filter follows a drawn shape, and a digit
     is drawn by the font. */
  text-shadow:
    0 0 1px var(--outline-on-image),
    0 0 1px var(--outline-on-image),
    0 0 3px var(--outline-on-image-soft);
}

/* The clearance a risen label needs belongs here, not to TextField, whose own
   notch clearance is calibrated for one field stacked on another rather than on
   a photograph (frontend ADR 0003 § 5). */
.field {
  margin-top: var(--space-2);
}
</style>
