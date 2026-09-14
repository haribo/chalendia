<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  addImage,
  describeImage,
  listImages,
  removeImage,
  reorderImages,
  type ImageRefusal,
  type ProductImage,
} from '@/shared/api/images'
import { prepare, SMALLEST_LONG_SIDE, type PreparationRefusal } from '@/shared/images/prepare'
import Alert from '@/shared/ui/Alert.vue'
import Button from '@/shared/ui/Button.vue'
import DropZone from '@/shared/ui/DropZone.vue'
import Grid from '@/shared/ui/Grid.vue'
import FilePicker from '@/shared/ui/FilePicker.vue'
import PageTitle from '@/shared/ui/PageTitle.vue'
import Stack from '@/shared/ui/Stack.vue'
import PhotographCard from '@/surfaces/admin/PhotographCard.vue'

/**
 * A product's photographs: add, order, describe, remove
 * (`docs/design/catalog.md` § 5, *In the back office*).
 *
 * The shop is the authority on the list. Every call that changes it answers
 * with the whole list, and this screen takes that answer rather than patching
 * what it holds — which is also what keeps a rank honest after a reorder.
 */
const props = defineProps<{ id: string }>()

const { t } = useI18n()

const MOST = 10

const images = ref<ProductImage[]>([])
const refusals = ref<string[]>([])
/** How many files are still on their way — nought means the list is settled. */
const sending = ref(0)
const removing = ref<number | null>(null)

const productId = computed(() => Number(props.id))
const locked = computed(() => sending.value > 0)
const missing = computed(
  () => images.value.filter((image) => !image.alternativeText?.trim()).length,
)

onMounted(read)

async function read() {
  const outcome = await listImages(productId.value)
  if (outcome.kind === 'listed') {
    images.value = outcome.images
  } else {
    refusals.value = [say(outcome.kind === 'refused' ? outcome.refusal : 'unreachable')]
  }
}

/**
 * The words a merchant reads, composed here and never taken from the shop's
 * `detail`: the shop cannot know the reader's language
 * (`docs/design/core.md` § 8).
 */
function say(refusal: ImageRefusal | 'unreachable', name = ''): string {
  const at = `catalogue.photographs.refused`
  switch (refusal) {
    case 'not-jpeg':
      return t(`${at}.notJpeg`, { name })
    case 'too-large':
      return t(`${at}.tooLarge`, { name })
    case 'too-heavy':
      return t(`${at}.tooHeavy`, { name })
    case 'too-many':
      return t(`${at}.tooMany`, { name, most: MOST })
    case 'not-the-same-images':
      return t(`${at}.stale`)
    case 'unreachable':
      return t(`${at}.unreachable`)
    default:
      return t(`${at}.unknown`, { name })
  }
}

function sayLocal(refusal: PreparationRefusal, name: string): string {
  const at = `catalogue.photographs.refused`

  return refusal.kind === 'too-small'
    ? t(`${at}.tooSmall`, { name, longSide: refusal.longSide, least: SMALLEST_LONG_SIDE })
    : t(`${at}.unreadable`, { name })
}

/**
 * Sends every file the merchant picked, one after another.
 *
 * The valid files of a batch go up even when one is refused: refusing nine
 * photographs because a tenth is too small makes the merchant start over for a
 * mistake the other nine did not make.
 */
async function send(files: FileList | File[]) {
  refusals.value = []
  sending.value += files.length

  for (const file of Array.from(files)) {
    const prepared = await prepare(file)
    if (prepared.kind === 'refused') {
      refusals.value.push(sayLocal(prepared.refusal, prepared.name))
      sending.value -= 1
      continue
    }

    const outcome = await addImage(productId.value, prepared.file)
    if (outcome.kind === 'image') {
      images.value.push(outcome.image)
    } else {
      refusals.value.push(
        say(outcome.kind === 'refused' ? outcome.refusal : 'unreachable', file.name),
      )
    }
    sending.value -= 1
  }
}

/** Swaps a photograph with its neighbour, then sends the whole list. */
async function move(index: number, by: -1 | 1) {
  const wanted = [...images.value]
  const other = index + by
  ;[wanted[index], wanted[other]] = [wanted[other], wanted[index]]

  const before = images.value
  images.value = wanted

  const outcome = await reorderImages(
    productId.value,
    wanted.map((image) => image.id),
  )
  if (outcome.kind === 'listed') {
    images.value = outcome.images
    return
  }

  // The shop refused: put back what it still holds rather than leaving the
  // merchant looking at an order nobody stored.
  images.value = before
  refusals.value = [say(outcome.kind === 'refused' ? outcome.refusal : 'unreachable')]
  if (outcome.kind === 'refused' && outcome.refusal === 'not-the-same-images') {
    await read()
  }
}

async function describe(image: ProductImage, text: string | null) {
  const outcome = await describeImage(productId.value, image.id, text)
  if (outcome.kind === 'image') {
    const at = images.value.findIndex((held) => held.id === image.id)
    if (at !== -1) {
      images.value[at] = outcome.image
    }
    return
  }

  refusals.value = [say(outcome.kind === 'refused' ? outcome.refusal : 'unreachable')]
}

async function confirmRemoval() {
  const id = removing.value
  removing.value = null
  if (id === null) {
    return
  }

  const outcome = await removeImage(productId.value, id)
  if (outcome.kind === 'removed') {
    images.value = images.value.filter((image) => image.id !== id)
    return
  }

  refusals.value = [say(outcome.kind === 'refused' ? outcome.refusal : 'unreachable')]
}
</script>

<template>
  <Stack :gap="6">
    <Stack :gap="2">
      <PageTitle>{{ t('catalogue.photographs.title') }}</PageTitle>
      <p class="rule">
        {{ t('catalogue.photographs.default') }}
      </p>
    </Stack>

    <Stack
      direction="row"
      :gap="4"
      align="center"
      class="head"
    >
      <span class="counter">
        {{ t('catalogue.photographs.counter', { held: images.length, most: MOST }) }}
      </span>
      <FilePicker
        :label="t('catalogue.photographs.add')"
        accept="image/*"
        multiple
        :disabled="images.length >= MOST"
        @picked="send"
      />
    </Stack>

    <Alert
      v-if="locked"
      tone="warning"
    >
      {{ t('catalogue.photographs.lockedWhileSending') }}
    </Alert>

    <Alert
      v-if="missing > 0"
      tone="warning"
    >
      {{ t('catalogue.photographs.missingCount', { count: missing }, missing) }}
    </Alert>

    <Alert
      v-for="refusal in refusals"
      :key="refusal"
      tone="danger"
    >
      {{ refusal }}
    </Alert>

    <DropZone
      v-if="images.length === 0"
      :disabled="locked"
      @dropped="send"
    >
      <FilePicker
        :label="t('catalogue.photographs.choose')"
        accept="image/*"
        multiple
        :disabled="locked"
        @picked="send"
      />
      <p class="hint">
        {{ t('catalogue.photographs.dropHint', { least: SMALLEST_LONG_SIDE, most: MOST }) }}
      </p>
    </DropZone>

    <Grid
      v-else
      :min-column="11"
      :gap="4"
    >
      <PhotographCard
        v-for="(image, index) in images"
        :key="image.id"
        :image="image"
        :rank="index + 1"
        :first="index === 0"
        :last="index === images.length - 1"
        :locked="locked"
        @move-back="move(index, -1)"
        @move-forward="move(index, 1)"
        @remove="removing = image.id"
        @retry="read"
        @describe="(text) => describe(image, text)"
      />
    </Grid>

    <Stack
      v-if="removing !== null"
      :gap="3"
      class="confirm"
    >
      <strong>{{ t('catalogue.photographs.confirmRemoval') }}</strong>
      <p class="detail">
        {{ t('catalogue.photographs.confirmRemovalDetail') }}
      </p>
      <Stack
        direction="row"
        :gap="2"
        class="buttons"
      >
        <Button @click="removing = null">
          {{ t('catalogue.photographs.cancel') }}
        </Button>
        <Button
          variant="primary"
          @click="confirmRemoval"
        >
          {{ t('catalogue.photographs.confirmRemovalAction') }}
        </Button>
      </Stack>
    </Stack>
  </Stack>
</template>

<style scoped>
.rule {
  margin: 0;
  color: var(--colour-text-muted);
  font: var(--style-caption);
}

.head {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
}

.counter {
  color: var(--colour-text-muted);
  font: var(--style-caption);
  font-variant-numeric: tabular-nums;
}

.confirm {
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-2);
  padding: var(--space-4);
  background: var(--colour-surface);
}

.detail {
  margin: 0;
  color: var(--colour-text-muted);
  font: var(--style-caption);
}

.buttons {
  flex-direction: row;
  justify-content: flex-end;
}
</style>
