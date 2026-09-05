# ADR 0004 — A table renders typed cells, never a caller's markup

## Status

Active

## Context

Two back-office screens draw a table by hand — the catalogue and the VAT rates —
and between them they carried 24 raw `table`, `thead`, `tr`, `th`, `td`, `ul` and
`li` elements in `src/surfaces/`. Frontend ADR 0003 forbids exactly this for
affordances and lint enforces it; structure was never covered, because nobody
had built the component that would replace it.

Building one raises a question that decides whether the component is worth
having: **how does a surface say what goes in a cell?**

The reference project answered with a slot per column. Its `DataTable.vue`
exposes `#cell-${column.key}`, and here is what a consumer puts in one:

```html
<template #cell-name="{ row }">
  <span class="block max-w-40 truncate text-(--color-text)">{{ row.name }}</span>
</template>
```

The generic table exists, the rule is written, lint is in place — and
hand-written markup with layout classes came back into the page through the
slot. Not through carelessness: the slot is the sanctioned way in, so using it
is the correct thing to do given that contract.

## Decision

**A table takes a closed vocabulary of typed cells.** Six kinds, and a surface
picks among them:

| Kind | For |
|---|---|
| `text` | plain text |
| `strong` | the row's identity — its name, its title |
| `number` | a figure: right-aligned by its column, always tabular |
| `code` | a reference someone reads character by character |
| `pill` | a state, carrying a shape as well as a tone |
| `actions` | one or more buttons |

A surface component translates its domain object into cells: `ProductTable`
turns a product into cells, `VatRateTable` turns a rate into cells, and the
table knows neither product nor currency. Changing how a row looks is one edit
in one file, which is the only reason to have the component at all.

**A need the vocabulary does not cover adds a kind**, with its own mockup and
its own validation. It does not open a slot and it does not take a `render`
prop.

Three consequences worth stating, because each was a choice:

- **A cell is described per row, not per column.** The rates screen is the
  proof: the same column carries a pill on the default rate and a button on the
  others. A table whose column fixed the kind could not render a screen that
  already exists.
- **An absent value is the cell's business.** Passing nothing renders a dash;
  no caller writes `?? '—'`, and the dash is the same everywhere.
- **Below the narrow threshold a row becomes a card, and only one shape is in
  the document.** Rendering both and hiding one with CSS puts every row in the
  page twice — this project shipped that defect twice (#41, then again in the
  catalogue), and each time a journey found the same text in two places. The
  test asserts it on the DOM, never on the styles.

## Rejected alternatives

- **A slot per column** (`#cell-${key}`) — rejected, with the evidence above.
  It is the most flexible answer and that is precisely the problem: it makes
  hand-written markup the sanctioned path, and the boundary the component exists
  to draw stops existing the day the first consumer needs something slightly
  different.
- **A `render` function per column** — rejected. The same escape hatch in
  TypeScript instead of a template.
- **A cell kind per screen** (`ProductStateCell`, `RateDefaultCell`) — rejected.
  It names cells after content, which ADR 0003 § 4 forbids for exactly the
  reason it would bite here: the vocabulary would grow by one entry per screen
  and stop being a vocabulary.

## Consequences

- A surface that needs a new kind of cell has to say so, in a mockup, before it
  can render it. That friction is the point: it is what keeps the sixth kind
  from becoming the sixtieth.
- Sorting, pagination and selection are **out**. The back office paginates
  server-side and the table does not need to know; adding them now would be
  designing for a screen nobody has drawn.
- The lint ban in ADR 0003 extends to `table`, `thead`, `tbody`, `tr`, `th`,
  `td`, `ul` and `li` in `src/surfaces/` once the two existing screens are
  migrated (#85). Extending it before that would fail on code that has nowhere
  else to go.
