# ADR 0001 — Frontend stack

## Status

Active

## Context

The frontend is a single-page application without a meta-framework (project ADR
0005). It carries two surfaces in one build: the public storefront and the staff back
office. It consumes a code-first OpenAPI contract (backend ADR 0002).

## Decisions

| Concern | Choice |
|---|---|
| Framework | Vue 3, composition API, `<script setup>` |
| Language | TypeScript, strict |
| Build | Vite |
| Routing | Vue Router, with the back office behind a route guard |
| State | Pinia, for state that outlives a route: session, cart, shop settings |
| API access | A single generated-type client; hand-written URLs are forbidden |
| Unit tests | Vitest |
| End-to-end tests | Playwright, against a running backend |
| Lint | ESLint with the Vue, TypeScript and accessibility plugins |

**One build, two surfaces.** Storefront and back office share the design system, the
API client and the i18n resources. The back office is route-guarded and code-split so
its weight never lands on a shopper's first page.

**Every string goes through i18n**, from the first screen, in English and French.
A literal user-facing string in a component is a defect, not a shortcut.

**All network access goes through the generated client.** Bypassing it bypasses the
contract, which is the only thing making a backend rename visible at build time.

## Rationale

- Vue 3 with `<script setup>` and TypeScript is the stack the project owner wants and
  is well served without a meta-framework: routing, state and build are three small,
  independently understood pieces.
- Pinia is scoped deliberately to cross-route state. Server data belongs to the
  component that requests it, or to a cache; putting every response in a store is how
  a SPA acquires a second, stale source of truth.
- Extracting hard-coded strings after the fact is mechanical, boring, and never
  finished. Doing it from the first screen costs nothing.
- Splitting the back office matters for the storefront's perceived performance, which
  ADR 0005 made a frontend responsibility.

## Alternatives considered

- **Nuxt** — rejected at project level in ADR 0005.
- **State in a global store by default** — rejected: duplicates server state and
  invites stale reads.
- **A separate application for the back office** — rejected for v1. It would isolate
  the bundles further, at the cost of duplicating the design system, the API client
  and the auth handling for a back office used by two people.

## Consequences

- The route guard is a convenience, never a protection: every restriction is enforced
  by the API and tested there (ADR 0003 negative authorization coverage).
- Adding a language means adding a resource file and its translations; no component
  changes.
- The generated API types are committed; a backend contract change shows up as a
  TypeScript error in the same PR.
- Accessibility is linted where lintable and reviewed where not; it is part of design
  conformance.
