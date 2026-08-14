# Delivery workflow

How a user-facing change gets from an idea to `develop`. Branch and pull-request
mechanics are in [git-workflow.md](git-workflow.md); what counts as *done* is in
[ADR 0003](adr/0003-release-criteria.md). This document states the **sequence**
and who decides what at each step.

Read it before starting any change that a user will see. A change nobody sees —
tooling, refactor, dependency — stops at step 5.

---

## The loop

| # | Step | Who | Skippable when |
|---|---|---|---|
| 1 | Issue | Either | Trivial change (typo, formatting, dependency bump) |
| 2 | Design | Assistant | The behavior is already specified in `docs/design/` |
| 3 | Mockup, validated | Assistant proposes, **user validates** | The change does not alter rendered output |
| 4 | Implementation with tests | Assistant | Never |
| 5 | Pull request with evidence | Assistant | Never |
| 6 | Visual review | Assistant produces, **user validates** | Nothing rendered changed |

Steps 3 and 6 are the only ones the assistant cannot complete alone. Everything
else is the assistant's responsibility, tests included.

---

## 1. Issue

Every change starts with one, per [git-issues.md](git-issues.md). The issue
carries the *what* and the *why*, the decisions already taken, and what is out
of scope. A later session must be able to implement it without the conversation
that produced it.

## 2. Design before code

If the change introduces or alters user-observable behavior, the rule in
`docs/design/` is written **first**, in the same branch, before the code.

- The design describes what the user observes, never how it is built
  ([ADR 0001](adr/0001-documentation-strategy.md)).
- If the design is silent on something the code needs, that silence is the bug:
  write the rule, then the code.
- If the code has to contradict the design, the design is amended explicitly, on
  its own — never silently.

## 3. Mockup before UI code

**A change that alters rendered output requires a mockup validated by the user
before a line of code is written.** This is the rule that saves the most
rework, and the one most tempting to skip.

What the mockup must contain:

- Every surface and **every state** the change touches — loading, empty, error,
  and the successful one. A mockup showing only the happy path validates
  nothing.
- Realistic data, including the edge cases: a long shop name, a crowded list, a
  string that is twice as long in the other language.
- Both themes when theming applies, side by side. The mockup carries its own
  token values so each theme is visible whatever the reader's own.
- Debated variants side by side, so the choice is made once.

What it must not contain: annotations inside the rendered mock. A label reading
"component X" falsifies what the reviewer is judging. Notes go in captions,
outside the frame.

**Validation is an explicit go on that specific mockup.** Silence is not
validation. A change in scope means a new mockup, not an assumption.

**The exemption**, and its price: a refactor that renders identically is exempt,
and says so explicitly, with before/after screenshots compared pixel by pixel.
"Identical" means zero differing pixels — anything else is a change, and it is
declared with its measured size and its cause.

## 4. Implementation with tests

Tests are the assistant's responsibility, never the user's, and never deferred
to a later pass. The levels required are in [ADR 0003](adr/0003-release-criteria.md)
§ 2.2; the rules that matter most in practice:

- **Test the thing, not a mock of the thing.** A test that mocks the function it
  is testing proves nothing. This has already produced a defect here: a 503 was
  reported as an unreachable API, and the panel's tests missed it because they
  mocked the reader they were exercising.
- **Every restricted action has a test proving the other role is refused.**
  Nobody reasons spontaneously about authorization, human or assistant.
- **A bug fix starts with a failing test** reproducing it from observed
  evidence, never from a hypothesis, and that test stays as the regression
  guard with its issue number.
- **Screenshots and video are not tests.** They are how the user checks the
  result; assertions are how the code is checked. Producing the first does not
  excuse the second.

## 5. Pull request with evidence

The body states what was **measured**, not what is believed:

- Numbers where a number exists: tests passing, duplicated rules removed,
  differing pixels, bundle weight.
- The command a reader can re-run to obtain the same result.
- Defects found on the way, including those the change itself introduced and
  fixed — a session that hides them teaches the next one nothing.
- What is **not** proven, named as such. A criterion that could not be verified
  is stated with its reason, never quietly dropped.

Every gate must be green before the merge, and a gate that does not exist yet is
said to not exist rather than assumed to pass.

## 6. Visual review

The user validates the final result on the report, not in a terminal.

The report carries, per case: the video of the journey, the screenshots of its
steps, and a **review status** — to review, validated, to fix. A case whose spec
changed after its validation returns to *to review*: a validation is anchored to
the code it was given for.

Every journey is **replayed** once per variant — desktop light, desktop dark,
phone — and the case's page toggles between the three. Replayed, not
re-rendered: a layout that breaks a tap target is invisible to a second
screenshot of the same run. A design that claims a dark theme and a phone layout
is validated when the three were looked at, so the report refuses to build when
a case is missing one, rather than showing a hole that reads as reviewed. A
journey that does not apply to a variant — a phone drawer has no meaning on a
desktop viewport — skips itself and says so with its reason; that is coverage,
not a hole. A journey skipped in *every* variant is a hole.

The reviewer's verdict:

| Verdict | What follows |
|---|---|
| Validated | Nothing; the status is recorded |
| To fix, blocking | An issue, fixed before the merge |
| To fix, minor | An issue, merged anyway, fixed in the next cycle |

A case that is never reviewed stays visibly *to review*. The count of unreviewed
cases is the backlog the user actually has.

In practice:

| Step | Command |
|---|---|
| Run the journeys and build the report | `just e2e` |
| Open it | `just e2e-open` |
| Record a verdict | edit `tools/e2e-report/reviews.json` |

An entry is keyed by `<spec>::<case title>` and carries `status`
(`reviewed` or `to-fix`, the latter with a mandatory `note`), `reviewedAt`, and
`specHash` — the hash of the spec file at review time, which is what sends the
case back to *to review* when the code it judged has changed. The file is
committed; the report itself is not.

---

## What this is not

- **Not a substitute for judgment.** The steps say when to ask, not what to
  build.
- **Not a gate the assistant can self-serve.** Steps 3 and 6 need a human, by
  construction: a validation the assistant grants itself is the absence of one.
- **Not proportional to size.** A one-line CSS change alters rendered output and
  needs a mockup; a thousand-line refactor that renders identically does not.
