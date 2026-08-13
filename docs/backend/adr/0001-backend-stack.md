# ADR 0001 — Backend stack

## Status

Active

## Context

The backend serves a JSON API (project ADR 0005) for a shop that must run on the
cheapest server a small merchant will pay for. The constraint that drives every
choice here is idle footprint and predictable memory, not peak throughput: a shop
with fifty visitors a day still has to survive a crawler burst without an OOM kill.

PostgreSQL is a given: it is the storage the project targets, and the features the
domain needs — transactional stock reservation, gapless numbering, full-text search,
range and partial indexes — are the reason.

## Decisions

| Concern | Choice |
|---|---|
| Language | Rust, stable toolchain, current edition |
| Async runtime | Tokio, multi-threaded scheduler |
| HTTP | axum, on the tower/hyper stack |
| Database access | sqlx with compile-time verified queries against a live schema |
| Migrations | sqlx migrations, applied automatically at startup |
| Observability | tracing with an environment-driven filter, structured output |
| Configuration | Environment variables, loaded from a root `.env` when present |

**No ORM.** Queries are SQL, verified at compile time by sqlx against the real
schema. A renamed column breaks the build.

**Migrations run at startup**, before the server accepts traffic, and are idempotent.
An operator who upgrades the image gets the schema change with no extra step; a
failed migration aborts startup rather than serving a half-migrated schema.

## Rationale

- Rust and Tokio give a single self-contained binary with no runtime to install and a
  memory profile that does not depend on a garbage collector's mood — the property
  that makes the small-server target realistic.
- axum is the mainstream choice on tower/hyper; its middleware ecosystem (tracing,
  CORS, compression, rate limiting) is shared with the wider tower ecosystem rather
  than framework-specific.
- Compile-time verified SQL gives the same guarantee an ORM claims — the code cannot
  reference a column that does not exist — without hiding the query. In a domain where
  stock reservation and money aggregation are the hard parts, the query is the thing
  worth reading.
- Automatic migration at startup is the only option compatible with "install by
  `docker compose up`". An operator who has to run a migration command manually will
  eventually not run it.

## Alternatives considered

- **An ORM (SeaORM, Diesel)** — rejected. Diesel's compile-time guarantees are strong
  but its DSL obscures the non-trivial queries this domain needs; SeaORM adds a
  runtime layer whose cost is paid on every request. Neither buys anything sqlx does
  not already give here.
- **SQLite instead of PostgreSQL** — rejected. A lighter footprint and a simpler
  install, at the cost of the concurrency behavior and the full-text and indexing
  features the catalog relies on. Reconsidering it would mean reopening ADR 0004's
  target.
- **Migrations as an explicit operator step** — rejected as the default; it is the
  step operators skip. A flag to disable automatic migration may be added for
  operators who manage schema changes themselves.

## Consequences

- Building the backend requires a reachable PostgreSQL schema for query verification,
  or a checked-in offline query cache. CI must keep that cache in sync and fail on
  drift.
- The binary embeds its migrations; the image needs nothing but the binary and a
  database URL.
- Long-running work (carrier calls, image derivation, expiring reservations) runs on
  the same process. A separate worker is out of scope until measurement says otherwise;
  the design keeps such work behind explicit boundaries so it can move later.
