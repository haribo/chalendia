import type { Component } from 'vue'

/**
 * What a table cell may be — the whole vocabulary, and nothing else.
 *
 * A surface translates its domain object into these: `ProductTable` turns a
 * product into cells, `VatRateTable` turns a rate into cells, and the table
 * itself knows neither product nor currency. Changing how a row looks is then
 * one edit in one file, which is the point of the component existing.
 *
 * A need this vocabulary does not cover **adds a kind here**, with its own
 * mockup. It does not open a per-column slot and it does not take a render
 * function: those are the same escape hatch under two names, and the reference
 * project's tables show where it leads — hand-written markup came back into the
 * pages through it (frontend ADR 0004).
 */

/** A cell's tone, when it has one. Never an action's: see ADR 0003 § 4. */
export type CellTone = 'neutral' | 'accent'

/** One button inside an `actions` cell. */
export interface CellAction {
  /** Read aloud, and shown unless the action is icon-only. */
  label: string
  /** Makes the action icon-only; `label` becomes its accessible name. */
  icon?: Component
  disabled?: boolean
  onPress: () => void
}

/**
 * A value the row does not have renders as a dash, and the cell is what knows
 * that — no caller writes `?? '—'`.
 */
export type Cell =
  /** Plain text. */
  | { kind: 'text'; value?: string }
  /** The row's identity: its name, its title. One per row. */
  | { kind: 'strong'; value?: string }
  /** A figure. Right-aligned by its column, and always tabular. */
  | { kind: 'number'; value?: string }
  /** A reference someone reads character by character. */
  | { kind: 'code'; value?: string }
  /** A state. Carries a shape as well as a tone, since colour never carries
      meaning alone (`docs/design/core.md` § 8). */
  | { kind: 'pill'; value?: string; tone?: CellTone }
  | { kind: 'actions'; actions: readonly CellAction[] }

export interface Column {
  /** Matches the key a row files its cell under. */
  key: string
  /** Empty for a column of actions, which names nothing. */
  header: string
  /** `end` for figures, so digits line up on their units. */
  align?: 'start' | 'end'
}

export interface Row {
  /** Stable across a reload: the identifier, never the index. */
  key: string | number
  cells: Readonly<Record<string, Cell>>
}

/** What a cell shows when it holds nothing. */
export const ABSENT = '—'
