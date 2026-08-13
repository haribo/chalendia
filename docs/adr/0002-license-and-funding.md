# ADR 0002 — License and funding model

## Status

Active

## Context

Chalendia is published as a downloadable, self-hostable product. Anyone may run it,
including commercially. The author wants the software to stay free of charge, to be
protected against a third party turning it into a closed hosted offering, and to be
able to accept donations without selling anything.

The license also has to be chosen before the first line of code: relicensing later
requires the agreement of every contributor.

## Decisions

### 1. License

**GNU AGPL-3.0-only**, applied to the whole repository (backend, frontend, docs,
tooling). The full text lives in `LICENSE`.

### 2. No contributor license agreement

Contributions are accepted under the same license, with no CLA and no copyright
assignment. The project therefore cannot relicense unilaterally, and cannot sell
proprietary exceptions.

### 3. Funding

Donations only, with no counterpart: no paid tier, no paid support commitment, no
feature bought by a sponsor. Donations do not confer influence on the roadmap.

Nothing in the product is disabled, delayed or gated behind payment. There is no
"enterprise edition".

## Rationale

- The AGPL is the license that matches the threat model of a self-hosted product:
  it is the only widely adopted license under which a hosted, modified fork must
  publish its modifications. Under a permissive license, the same fork owes nothing.
- Refusing a CLA is a deliberate loss of optionality. It removes the ability to sell
  exceptions later, and in exchange removes the friction and the trust problem a CLA
  creates for occasional contributors. The funding model chosen here does not rely on
  selling licenses, so the optionality has no value to trade for.
- Donations without counterpart keep the project honest about what it is: unpaid work
  that some users choose to support. A paid support promise would be a service
  business with obligations the author has not committed to.

## Alternatives considered

- **Apache-2.0 / MIT** — rejected. Maximum adoption and an explicit patent grant
  (Apache), but a hosting company can build a closed service on Chalendia and return
  nothing. For an e-commerce platform, that is the likely commercial outcome, not a
  hypothetical one.
- **AGPL + sold commercial exceptions (dual licensing)** — rejected. Requires a CLA
  on every contribution, which deters casual contributors and creates a two-class
  community. Only worth its cost if selling licenses is an actual plan; it is not.
- **BSL / source-available** — rejected. It blocks the competing hosted offering but
  is not open source: excluded from distributions, rejected by part of the community,
  and it contradicts the project's stated purpose.

## Consequences

- A merchant may run Chalendia commercially, modified or not, with no obligation
  toward the project — as long as they do not distribute or network-serve a modified
  version without publishing its source.
- A merchant who modifies Chalendia and exposes it to their own customers over the
  network owes those users the corresponding source. This is a real obligation and it
  must be stated plainly in the operator documentation, not buried.
- Every source file may carry an AGPL header; the `LICENSE` file is authoritative.
- Third-party dependencies must be license-compatible. A dependency under a license
  incompatible with AGPL-3.0 cannot be added, whatever its technical merit.
- Relicensing later would require contacting every contributor. Treat the choice as
  final.
