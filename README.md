# Chalendia

Self-hosted online shop for small merchants: a Rust HTTP API, a Vue 3 storefront
and back office, PostgreSQL for storage. Designed to run on the smallest server
a merchant is willing to pay for.

**Status: design phase.** No application code yet — the product is being specified
first. See [`docs/design/core.md`](docs/design/core.md) for the product rules and
[`docs/adr/`](docs/adr/) for the decisions behind them.

## What it is meant to do

Sell physical products with variants, take card payments through Stripe Checkout
or bank transfer, ship with a real carrier, issue invoices, and be installable by
one `docker compose up` followed by a setup screen.

Scope of the first release is fixed in
[ADR-0004](docs/adr/0004-v1-release-scope.md); everything outside it is deliberate.

## Getting started (contributors)

```bash
just hooks-install   # once per clone — the repository's git hooks are opt-in
just --list          # available targets
```

## Documentation

| Where | What |
|---|---|
| [`docs/design/`](docs/design/) | Product rules as observed by the user |
| [`docs/adr/`](docs/adr/) | Project-level decisions with rationale |
| [`docs/backend/`](docs/backend/), [`docs/frontend/`](docs/frontend/) | Layer decisions and conventions |
| [`docs/git-workflow.md`](docs/git-workflow.md) | Branching, PRs, CI gates |

## License

[GNU AGPL-3.0](LICENSE). You may run, modify and redistribute Chalendia freely;
if you distribute it or offer a modified version over a network, your changes must
be published under the same license. Chalendia is free of charge and always will
be — donations are welcome and buy nothing but the author's time.
