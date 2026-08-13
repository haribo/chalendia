# ADR 0004 — Database conventions

## Status

Active

## Context

Every later migration inherits the conventions the first one establishes. Changing
them afterwards means rewriting tables that already hold a merchant's orders, so
they are decided once, before the first domain table exists.

The open questions were the primary key type, how time and money are stored, and
how a row's modification timestamp is maintained.

## Decisions

| Concern | Decision |
|---|---|
| Primary keys | `bigint generated always as identity` |
| Public references | Their own column when the design requires unguessability, never the key |
| Time | `timestamptz`, always UTC |
| Money | `bigint`, minor units of the shop currency |
| Names | snake_case; tables plural, columns singular |
| Modification timestamp | `updated_at`, maintained by a database trigger |
| Direction | Forward only; a mistake is corrected by a new migration |

The first migration ships the shared `set_updated_at()` trigger function that every
mutable table attaches to.

## Rationale

- **Sequential integer keys** are half the width of a UUID, keep indexes and foreign
  keys compact, and cluster naturally by insertion order — which matters on the
  small server this product targets. Their weakness is that they are guessable, and
  that weakness only bites when a key is exposed; the design already requires a
  separate, unguessable order reference, so the two concerns are separated rather
  than conflated.
- **`timestamptz`** removes the class of bug where a value's meaning depends on the
  session's timezone. `timestamp` without a zone is not "UTC by convention", it is
  "unknown by construction".
- **Integer minor units** make every monetary comparison and sum exact. Floating
  point in a pricing path is a defect, and per-column `numeric` scales invite
  inconsistency between tables that must agree.
- **A trigger, not application code**, for `updated_at`: it stays true for a value
  written by a migration or by a human at a psql prompt, which is exactly when a
  stale timestamp misleads whoever is investigating.
- **Forward-only migrations** match the delivery model: an operator upgrades an
  image and the schema follows. Down migrations promise a reversal nobody tests, on
  data that has already changed.

## Alternatives considered

- **UUID v7 primary keys** — rejected. Sortable and unguessable, at twice the width
  in every index and foreign key. The unguessability is only needed where a
  reference is exposed, and a dedicated column serves it without taxing every join.
- **`timestamp` with an application-side UTC convention** — rejected. It relies on
  every writer honouring a convention the database does not enforce.
- **`numeric` for money** — rejected. Exact, but invites a different scale per
  column and costs more per row than an integer for a domain with one currency.
- **Reversible migrations** — rejected as a default. They double the surface, are
  rarely exercised, and give false confidence about recovering from a bad deploy;
  the real recovery path is a restore, which is the operator's responsibility.

## Consequences

- A table added without `created_at`, `updated_at` and its trigger is inconsistent
  with the rest of the schema; review checks it.
- Exposing a `bigint` key in a public URL or document is a design decision, not a
  default: it leaks volume. Where the design calls for a reference, it gets its own
  column.
- Downgrading to a previous image after a schema change is unsupported, and release
  notes must say when a version changes the schema.
