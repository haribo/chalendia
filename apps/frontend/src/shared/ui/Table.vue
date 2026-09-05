<script setup lang="ts">
import { computed } from 'vue'

import Stack from '@/shared/ui/Stack.vue'
import TableCell from '@/shared/ui/TableCell.vue'
import type { Cell, Column, Row } from '@/shared/ui/table'
import { useNarrowScreen } from '@/composables/useNarrowScreen'

/**
 * Rows of typed cells, as a table — or as cards when the screen is too narrow
 * for one.
 *
 * It knows nothing of any domain. A surface hands it columns and rows whose
 * cells come from the closed vocabulary in `table.ts`; there is no per-column
 * slot and no render prop, deliberately (frontend ADR 0004).
 */
const props = defineProps<{
  columns: readonly Column[]
  rows: readonly Row[]
  /** Shown instead of column headers over nothing. */
  empty: string
  /** Names the table for assistive technology. */
  label: string
}>()

const { narrow } = useNarrowScreen()

/**
 * The first column titles a card; the rest become its line of metadata. That
 * is what both back-office tables already do by hand, and making it the rule
 * is what lets a surface stop deciding it.
 */
const [titleColumn, ...restColumns] = props.columns

function cellOf(row: Row, column: Column): Cell {
  return row.cells[column.key] ?? { kind: 'text' }
}

const hasRows = computed(() => props.rows.length > 0)
</script>

<template>
  <p
    v-if="!hasRows"
    class="empty"
  >
    {{ empty }}
  </p>

  <!--
    One shape or the other, never both. Rendering the table and the cards and
    hiding one with CSS puts every row in the document twice — this project has
    shipped that defect twice, and each time a journey found the same address
    in two places.
  -->
  <table
    v-else-if="!narrow"
    :aria-label="label"
  >
    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.key"
          :class="['text-label', column.align ?? 'start']"
        >
          {{ column.header }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.key"
      >
        <td
          v-for="column in columns"
          :key="column.key"
          :class="column.align ?? 'start'"
        >
          <TableCell :cell="cellOf(row, column)" />
        </td>
      </tr>
    </tbody>
  </table>

  <Stack
    v-else
    as="ul"
    :gap="3"
    class="cards"
    :aria-label="label"
  >
    <li
      v-for="row in rows"
      :key="row.key"
    >
      <TableCell :cell="cellOf(row, titleColumn)" />
      <span class="meta">
        <TableCell
          v-for="column in restColumns"
          :key="column.key"
          :cell="cellOf(row, column)"
        />
      </span>
    </li>
  </Stack>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: var(--space-1) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
}

td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--colour-border);
  vertical-align: middle;
}

.start {
  text-align: left;
}

.end {
  text-align: right;
}

/* Even rows on a barely-there ground, so the eye keeps its line across five
   columns. The token is the one the shop already raises a surface with, which
   is what makes this work in both themes rather than in one. */
tbody tr:nth-child(even) {
  background: var(--colour-surface-raised);
}

.cards li {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--colour-border);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.empty {
  margin: 0;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: var(--colour-text-muted);
}
</style>
