# ADR 0003 — Shared components and surface components

## Status

Active

## Context

Two screens existed and nine CSS rules were already duplicated byte-for-byte
between components: the language and theme pickers carried the same select
chrome, the storefront and back-office layouts carried the same shell and bar,
the two views styled the same heading.

Nothing was wrong with any single file. The problem is the trajectory: each new
screen starts as a copy of the nearest existing one, the copies drift, and the
shop ends up with four subtly different selects that nobody decided.

The reference project (tribnest) answers this with generic primitives in one
place, feature composites that compose them, and lint rules banning raw
affordance HTML outside the system. That project carries 289 components. This
one carries six — which is why the contract is worth fixing now and painful to
retrofit later.

## Decisions

### 1. Two kinds of component

| Kind | Lives in | Named after | Knows about |
|---|---|---|---|
| **Shared component** | `src/shared/ui/` | A contract: `SelectField`, `AppBar`, `PageTitle` | Nothing of the shop's domain |
| **Surface component** | `src/surfaces/<surface>/` | A concept: `DashboardView`, `StorefrontLayout` | Its surface, its domain, its data |

The naming test: if the name reads as content, it is a surface component. A
`ProductCard` is never shared, whatever its markup; a `Card` may be.

### 2. Surface components compose, they do not re-implement

A surface component uses shared components for every affordance one exists for.
It may add layout, ordering, conditions and handlers around them. It may not
rebuild an affordance with a different DOM and its own CSS.

Raw `<select>`, `<button>` and `<input>` are therefore forbidden outside
`src/shared/ui/`, and lint enforces it. The rule is not aesthetic: an affordance
rebuilt by hand is an affordance whose accessible behavior was never reviewed.

### 3. When a duplication becomes a shared component

**Two occurrences of the same affordance.** Not three, not "when it hurts".

The usual rule of three assumes extraction is cheap to defer. Here it is not:
the second copy is where the drift starts, and a shop's interface is mostly
repeated affordances. Two identical usages, or two usages differing only by
content, become a shared component.

A single occurrence stays where it is. A shared component created for one caller
is a guess about a contract nobody has needed yet.

### 4. Variants express a contract, not a content

A shared component's props describe what it does — a select's options, a bar's
actions slot — never what it is used for. No `LanguageSelect`, no `AdminBar`. If
a variant name reads as a use case, the variant belongs to the caller.

### 5. Style lives with the component that owns it

Shared components carry the CSS of what they render, scoped. Surface components
carry only layout — how they place their children — and nothing that redefines a
shared component's look.

Every value is a semantic token (frontend ADR 0002); this ADR adds where the
declarations live, not which values they may use.

## Rationale

- The two-occurrence threshold is the whole decision. Everything else follows
  from it, and it is the only part a future session might be tempted to relax.
- Keeping shared components ignorant of the domain is what makes them reviewable
  once: a `SelectField` has one accessible behavior to get right, and every
  screen inherits it.
- Enforcing by lint rather than by review is what keeps the rule true after the
  first busy week.

## Alternatives considered

- **Feature-Sliced Design**, as the reference project uses — rejected for now.
  It organises a catalogue of features; this project has two surfaces and no
  feature catalogue. Adopting the layout early would mean empty directories and
  a vocabulary that describes nothing here. Revisit when surfaces grow into
  independently-owned features.
- **The rule of three** — rejected, per § 3.
- **A component library dependency** — rejected. The shop must be re-themable by
  a merchant through tokens (ADR 0002); a third-party library brings its own
  theming model, its own bundle weight, and its own accessibility decisions.
- **Global CSS classes instead of components** — rejected. A class cannot carry
  the accessible structure (the label association, the ARIA wiring); it only
  carries the paint.

## Consequences

- A new affordance used twice triggers extraction in the same PR that creates
  the second usage, not a later cleanup.
- `src/shared/ui/` is reviewed more carefully than a surface: its contract is
  inherited by every screen.
- Lint rejects raw affordance elements in surfaces; the message points here.
- Extraction PRs that must not change the rendering prove it with before/after
  screenshots, which is what exempts them from a new mockup validation under
  `CLAUDE.md` § Frontend.
