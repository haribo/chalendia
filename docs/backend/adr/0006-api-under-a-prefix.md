# ADR 0006 — The API lives under /api

## Status

Active

## Context

One process serves two things on one origin: the JSON API, and the single-page
application whose deep links are ordinary paths (project ADR 0005). Both need
addresses, and they were drawing from the same pool.

The collision is not hypothetical. `POST /api/setup` and the interface's own
`/setup` page shared a path: navigating to it answered `405 Method Not Allowed`
in JSON instead of serving the page, because the router matched the path, found
no `GET`, and refused before the static fallback could answer.

An end-to-end journey caught it. Nothing in the unit tests could have: each half
was correct on its own.

The next collisions were already scheduled — `/products`, `/orders` and
`/account` are all both an API resource and a page.

## Decisions

Every route the API answers lives under **`/api`**. Everything else belongs to
the interface: unknown paths fall through to the application shell, which owns
its own routing and its own not-found page.

This includes the routes that are not domain resources: `/api/health` for
supervision, `/api/openapi.json` for the published contract.

## Rationale

- It removes the whole class of collisions rather than the one that was found. A
  rule that has to be re-applied per route is a rule that gets forgotten on the
  route that matters.
- The boundary becomes readable from the address alone: an operator reading logs
  or a proxy configuration can tell an API call from a page load without knowing
  the route table.
- It makes the fallback unambiguous: anything outside `/api` is the shell's, so
  a new page needs no server-side change at all.

## Alternatives considered

- **Renaming the colliding route** (`POST /api/shop/setup`) — rejected. It fixes
  one case and leaves the rule undiscovered until the next one, which would land
  in the catalogue.
- **Serving the interface from a subpath** (`/app`) instead — rejected. It puts
  the ugliness on the side users see, and every shop URL, every shared product
  link and every canonical tag would carry it.
- **Distinguishing by `Accept` header** — rejected. It makes the same address
  mean two things depending on a header, which is unreadable in logs and fragile
  with crawlers.
- **A separate port for the API** — rejected. It reintroduces cross-origin
  behaviour, cookies included, in production as well as development.

## Consequences

- The published contract changes shape: every documented path now starts with
  `/api`. Nothing outside this repository consumes it yet, which is why the
  decision is cheap today and would not have been in six months.
- Frontend calls follow automatically: the client is generated from the contract,
  so the paths came along with the regeneration.
- An operator's supervision probes `/api/health`; the container image and the
  compose file describe it that way.
- A new page never requires a server-side route. A new API resource always
  requires the prefix, and the contract test makes an unprefixed one visible.
