# ADR 0003 — Release criteria

## Status

Active

## Context

Chalendia ships feature by feature, with no public release date. Without a written
definition of "done", the bar moves silently whenever delivery feels slow, and no
later session can answer "is this feature ready?" against a stable standard.

ADR 0004 (v1 release scope) relies on this definition rather than restating it.

## Decisions

### 1. Pilot model

Feature by feature, not by date. No public release date is announced. Internal
estimates are fine for planning; they are never communicated as commitments.

### 2. A feature is done when both hold

#### 2.1 Conformance to design

- The implementation matches the section of `docs/design/` that owns the feature.
- Conformance is checked at review time, design section open next to the diff.
- A disagreement between code and design is resolved by fixing the code — unless the
  design is the bug, in which case a design amendment lands first, on its own.

#### 2.2 Test coverage

Functional coverage, not numerical coverage.

| Layer | What must be covered |
|---|---|
| Unit | Non-trivial business logic: totals, tax, discounts, stock transitions, order state machine, address and identity normalization |
| Integration | Every HTTP route introduced or modified, against a real PostgreSQL instance, including authorization failures |
| End-to-end | Critical user paths, against a running backend: browse, add to cart, sign in, order, pay, and on the staff side receive, fulfill, ship |

**Negative authorization coverage** — every action restricted to a role has a test
proving the other role is refused. A positive matrix states what must be allowed;
without its mirror, an authorization regression passes both human and LLM review,
because neither reasons spontaneously about authorization invariants.

**Explicitly rejected**: a minimum coverage percentage as a merge gate. Chasing a
percentage produces tests on trivial code paths, slows the suite, and buys a false
sense of safety. A coverage report is a diagnostic, never a target.

### 3. Mandatory pre-merge checks

- Lint, format and type checks pass for every layer the PR touches.
- Unit and integration suites are green.
- The end-to-end suite is green on the impacted path.
- Generated artifacts (OpenAPI document, frontend API types) are up to date — CI
  regenerates and fails on any diff.
- Commit messages and PR body follow `docs/git-commits.md` and `docs/git-workflow.md`.

A failure on code unrelated to the PR still blocks the merge. It is fixed or
explicitly tracked and acknowledged first; it is never bypassed.

### 4. Out of scope of "done"

- **Performance benchmarks** — not a default gate. Where a feature carries a real
  performance constraint, the design document states it and the gate follows from
  there.
- **Feature flags and progressive roll-out** — not in v1. Features ship as one switch.
- **Accessibility** — not out of scope, but not a separate gate either: it is part of
  design conformance, because the design documents state the accessible behavior.

## Consequences

- "Is feature X ready?" becomes a check against this ADR instead of a conversation.
- Reviewers may reject a PR that lacks integration or authorization tests without
  negotiating case by case.
- The test suites must stay fast and reliable, otherwise this bar and daily iteration
  are in tension. Investment in test reliability is implicitly endorsed here.
