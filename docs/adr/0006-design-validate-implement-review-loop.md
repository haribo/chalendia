# ADR 0006 — Design, validate, implement, review

## Status

Active

## Context

This project is built by an assistant working with one person who is neither
watching the code as it is written nor able to review every diff. That person
needs two things a pull request does not give: a say on what a screen will look
like **before** it exists, and a way to see what was actually built **after** it
does.

Both were happening informally. The mockup rule lived in `CLAUDE.md`, the
release criteria in ADR 0003, the branch mechanics in `docs/git-workflow.md`,
and the sequence connecting them lived nowhere — which means a session with no
memory of the conversation would have rebuilt it, differently, for the next
feature.

The reference project (tribnest) converged on the same loop, with a report
listing each journey's video and screenshots and a per-case review status. It
works there; the decision is to adopt it here before the product has screens
rather than after.

## Decisions

### 1. The loop

Issue → design → **mockup validated** → implementation with tests → pull request
with evidence → **visual review**. The sequence and its skip conditions are
documented in [`docs/delivery-workflow.md`](../delivery-workflow.md).

### 2. Two human gates, and only two

The user validates the mockup (before code) and the visual result (after). Every
other step is the assistant's responsibility — design, tests, evidence, gates.

The assistant never grants itself either gate. A validation it awards itself is
the absence of one.

### 3. Tests are not visual review, and neither replaces the other

Assertions prove behavior; screenshots and video show a result. The report
exists because a human eye catches what no assertion was written for — a
truncated string, a broken layout at one viewport, a theme bleeding through.
Producing a report never excuses a missing test, and a green suite never excuses
skipping the review of something the user asked to see.

### 4. A validation is anchored to the code it was given for

A case whose spec changed after its review returns to *to review*. Otherwise a
validation slowly becomes a claim about code nobody looked at.

### 5. The review artefacts are built with the first journey that needs them

The report is not built ahead of the tests it presents. It ships with the first
real journey, so it is proven by use rather than by intention.

### 6. Process documents are a family of their own

`docs/git-*.md` and `docs/delivery-workflow.md` describe how work is done, not
what the product does, how a layer is built, or why a decision was taken. ADR
0001 § 3 named three document types and did not anticipate this fourth; it is
recognised here rather than forced into "technical documentation", which is
scoped to a layer.

## Rationale

- **Mockup first is the cheapest correction point.** Rework after implementation
  costs the code, its tests and its review; rework on a mockup costs a rewrite of
  the mockup. This session produced two mockups and neither needed a second
  round, which is the outcome the rule is for.
- **The report answers a question the pull request cannot.** A diff tells a
  reviewer what changed; it does not tell them whether the screen is right. The
  person deciding that is not reading the diff.
- **Anchoring reviews to the code** is what separates a review trail from a
  decoration. Without it, the oldest validations are the least trustworthy and
  nothing says so.

## Alternatives considered

- **Implement, then review** — the default everywhere, rejected. It moves the
  disagreement to the most expensive moment, and in practice the reviewer
  accepts what exists because rejecting it wastes visible work.
- **Automated visual regression only** (pixel diff against baselines) — rejected
  as the primary mechanism. It catches a change against yesterday, never a
  design that was wrong from the start, and it says nothing the first time a
  screen appears. Worth adding later as a guard, not as the review.
- **Reviewing in a running application** rather than a report — rejected. It
  requires the user to install and run the stack, and leaves no trace of what was
  reviewed, when, and against which code.
- **A review status in the issue tracker** rather than in the repository —
  rejected. The status has to be diffable and to travel with the code it judges;
  a comment thread does neither.

## Consequences

- A change altering rendered output cannot be merged without an explicit
  validation. This blocks the assistant, on purpose.
- The assistant produces mockups as a normal part of the work, not on request.
- The report becomes a deliverable with its own maintenance: an unreviewed case
  is visible, and the count of them is the user's real backlog.
- A session with no context can follow `docs/delivery-workflow.md` and reproduce
  the loop for a feature nobody has described to it.
