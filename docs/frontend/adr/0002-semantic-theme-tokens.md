# ADR 0002 — Semantic theme tokens

## Status

Active

## Context

A merchant must be able to make the shop look like theirs from the back office:
identity (name, logo, favicon), colours, typography, and a choice among a few shipped
themes. Themes change colours and styles only — never layout (ADR 0004).

Applying that after the fact means revisiting every component that hard-coded a
colour. It is only cheap if it is decided before the first screen.

## Decisions

Every visual value in a component references a **semantic token**, never a literal
and never a palette entry.

- Tokens are named by role, not by appearance: surface, elevated surface, primary
  action, on-primary, border, muted text, danger, success. `--colour-primary`, not
  `--blue-600`.
- A theme is a set of token values. Shipped themes and the merchant's own settings
  produce the same thing: token values applied at the document root at runtime.
- Merchant settings override the selected theme's tokens; nothing is compiled per
  shop.
- Light and dark are token sets, not a separate stylesheet. Every shipped theme
  defines both.
- Spacing, radius, typographic scale and elevation are tokens too. A theme may change
  them; it may not change layout structure.

Hard-coded colour values in components are a lint failure.

## Rationale

- Runtime tokens are what allows merchant customization without a build step, which is
  a hard requirement for a product installed as a container image.
- Naming by role is what makes a theme swappable: a token named after its colour
  becomes a lie the moment a theme changes it, and the component that used it cannot
  be re-themed without editing.
- Enforcing this by lint rather than by review is what keeps it true after the first
  month.

## Alternatives considered

- **Compiled per-shop CSS** — rejected: requires a build in the merchant's
  installation, which the delivery model excludes.
- **Palette-level tokens only** (`--blue-600`) — rejected: they leak appearance into
  components and break under a theme with a different palette.
- **Component-level overrides in settings** — rejected: it is layout customization
  through the back door, excluded by ADR 0004.

## Consequences

- The design system is built on the token set from the first component; a component
  merged with literal values is a defect to fix, not a debt to schedule.
- Contrast requirements apply to token pairs, so a merchant-chosen colour must be
  validated against its surface at settings time, with a warning when the pair fails
  the accessibility threshold. The threshold and the behavior belong to the storefront
  design.
- Adding a shipped theme is adding a token set; no component changes.
