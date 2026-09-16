<script setup lang="ts">
import Button from '@/shared/ui/Button.vue'
import Pill from '@/shared/ui/Pill.vue'
import { ABSENT, type Cell } from '@/shared/ui/table'

/**
 * One cell, rendered by its kind.
 *
 * Split out of the table so the vocabulary lives in one file: a table row and
 * a narrow-screen card both render cells, and rendering them twice is how the
 * two would come to disagree.
 */
const props = defineProps<{ cell: Cell }>()

/** Whether the cell holds nothing, so it can say so once here. */
function isAbsent(cell: Cell): boolean {
  return cell.kind !== 'actions' && (cell.value === undefined || cell.value === '')
}

function text(cell: Cell): string {
  return cell.kind === 'actions' ? '' : (cell.value ?? ABSENT)
}
</script>

<template>
  <span
    v-if="cell.kind === 'actions'"
    class="actions"
  >
    <Button
      v-for="action in cell.actions"
      :key="action.label"
      :variant="action.icon ? 'icon' : 'link'"
      :disabled="action.disabled"
      :aria-label="action.icon ? action.label : undefined"
      @click="action.onPress"
    >
      <component
        :is="action.icon"
        v-if="action.icon"
      />
      <template v-else>{{ action.label }}</template>
    </Button>
  </span>

  <!-- A link, not a button: opening a product is a navigation. A row whose
       name cannot be opened in a new tab is a row that owns its own address
       and refuses to share it. An absent value falls through, since a link
       around a dash leads nowhere by definition. -->
  <RouterLink
    v-else-if="cell.kind === 'link' && !isAbsent(cell)"
    class="strong opens"
    :to="cell.to"
  >
    {{ text(cell) }}
  </RouterLink>

  <Pill
    v-else-if="cell.kind === 'pill' && !isAbsent(cell)"
    :tone="cell.tone"
    :icon="cell.icon"
  >
    {{ text(cell) }}
  </Pill>

  <!-- An absent pill falls through to here, and reads as plain text: an
       outlined pill around a dash announces a state called "—". -->
  <span
    v-else
    :class="[
      props.cell.kind === 'pill' || props.cell.kind === 'link' ? 'text' : props.cell.kind,
      { absent: isAbsent(cell) },
    ]"
  >{{ text(cell) }}</span>
</template>

<style scoped>
.text {
  font: var(--style-body);
}

.strong {
  font: var(--style-body-strong);
}

/* The row's name, and the way in. Underlined only when aimed at: a column of
   permanently underlined titles reads as a list of links rather than as the
   things they name. */
.opens {
  color: var(--colour-accent);
  text-decoration: none;
}

.opens:hover,
.opens:focus-visible {
  text-decoration: underline;
}

.number {
  font: var(--style-body);
  /* Digits on a common width, so a column of prices lines up on its units. */
  font-variant-numeric: tabular-nums;
}

.code {
  font: var(--style-caption);
  font-family: var(--font-mono);
  color: var(--colour-text-muted);
}




.actions {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
}

/* A missing value is quieter than a present one, whatever its kind. */
.absent {
  color: var(--colour-text-muted);
}
</style>
