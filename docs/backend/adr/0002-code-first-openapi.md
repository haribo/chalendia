# ADR 0002 — Code-first OpenAPI

## Status

Active

## Context

The frontend is a separate application consuming the API over HTTP (project ADR
0005). Without a machine-readable contract, a renamed field is discovered at runtime,
in the browser, by a user.

Two approaches exist:

- **Spec-first** — the OpenAPI document is written by hand and server code is
  generated from it. This is what the author's other project does, using a mature Go
  generator in strict mode, where a contract mismatch is a compile error.
- **Code-first** — the OpenAPI document is derived from annotated handlers and types.

## Decisions

The API contract is **code-first**. The OpenAPI document is generated from the Rust
handlers and types, checked into the repository as a generated artifact, and never
edited by hand.

The frontend generates its TypeScript types from that document and calls the API
through a client typed against them. A renamed field therefore breaks the frontend
build, not a production request.

CI regenerates both artifacts and fails if either differs from what is committed.

The generated document is also the API's public documentation: it is published with
each release so that anyone can write another client.

## Rationale

- The decisive argument for spec-first in the reference project is its strict server
  generator: the compiler enforces conformance. Rust has no equivalent of comparable
  maturity, so spec-first here would keep the discipline but lose the enforcement —
  the worst trade of the two.
- The classic objection to code-first is that the document is a derivative artifact
  that can drift from the implementation. In Rust the response schemas are derived
  from the very types that are serialized, so the document cannot misdescribe a body.
  The residual risk is confined to what is annotated by hand — paths, parameters,
  status codes — and that surface is covered by the integration tests, which exercise
  those exact paths and codes.
- The property that actually matters end to end — a backend change breaking the
  frontend build rather than production — is obtained either way.

## Alternatives considered

- **Spec-first with a generated Rust server** — rejected for now. The available
  generator was not assessed as mature enough to be the project's contract enforcer.
  Revisit if that changes; it would be a new ADR.
- **Hand-written TypeScript types on the frontend** — rejected. Types that compile
  against nothing are documentation with a false claim of safety.
- **Runtime contract validation only** — rejected. Drift surfaces on real traffic;
  compile-time checking is strictly stronger.

## Consequences

- Adding or changing a route means annotating it; an unannotated route is invisible to
  the frontend and to the published documentation. Treat a missing annotation as a
  build failure, not a style issue.
- The generated document and the generated frontend types are committed and reviewed:
  their diff is the visible contract change in a PR.
- Error responses follow one machine-readable shape across the whole API, declared in
  the contract. The shape itself is a backend convention documented separately.
- No API versioning in v1: frontend and backend ship together, from one repository, to
  one deployment. A published third-party client is a consumer of a versioned release,
  not of a versioned API surface.
