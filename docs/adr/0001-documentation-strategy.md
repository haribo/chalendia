# ADR 0001 — Documentation strategy

## Status

Active

## Context

Chalendia is specified before it is written. That inverts the usual failure mode:
instead of documentation lagging behind code, the risk is documentation that grows
without a shared model of who reads it, what it owns, and when it is updated.

This ADR fixes the framework so that later sessions do not re-litigate the same
questions at every new file.

## Decisions

### 1. Audience priority

| Priority | Audience |
|----------|----------|
| **PRIMARY** | Solo dev + Claude assistants |
| **SECONDARY** | Future contributors and self-hosting operators |
| **OUT OF SCOPE** | Non-technical stakeholders |

Style is optimized for PRIMARY: dense, factual, table-heavy. SECONDARY is served
without extra pedagogy — a senior dev reads design, ADRs, then code.

Operator-facing material (install, upgrade, backup) is a SECONDARY concern that
still belongs in `docs/`, because the operator is the product's actual user.
Marketing material is out of scope for `docs/`.

### 2. Source of truth

| Source | Scope |
|--------|-------|
| `docs/design/` | The shop as observed by its users — shopper, staff, operator. What the system does, what each role can and cannot do, business rules |
| Code | How it is implemented. Includes migrations, the generated OpenAPI document, and type definitions |
| `docs/adr/`, `docs/{backend,frontend}/adr/` | Decisions with rationale and rejected alternatives |
| `docs/{backend,frontend}/*.md` | Conventions and operational rules that are neither design nor decision |

**Forbidden**: documentation that paraphrases code. Table schemas, function
signatures, JSON field names, file trees — if it is derivable by reading the code,
it does not go in a document.

**Discriminant test** — when unsure whether a fact belongs to design or to code:

- If the value can change without changing user-observable behavior, it is HOW → code.
  Examples: a JSON field name, a page-size cap of 50 versus 100, an HTTP status choice.
- If behavior depends on the value or its existence, it is WHAT → design.
  Examples: "lists are paginated server-side", "an invoice is never modified after issue",
  "stock is released when an unpaid order expires".

A rule may live in design (the *what*) and have its rationale in an ADR (the *why*).
That is not duplication.

### 3. Document types

Three types only.

| # | Type | Location | Scope |
|---|---|---|---|
| 1 | **Design** | `docs/design/` | User-observable rules |
| 2 | **ADR** | `docs/adr/`, `docs/{backend,frontend}/adr/` | Decisions, alternatives rejected, consequences |
| 3 | **Technical doc** | `docs/{backend,frontend}/*.md` | Conventions and operational rules |

Out of scope as types: code comments (a code construct, not a document), the root
`README.md` (a GitHub convention), onboarding tutorials (add one only if a real gap
appears).

### 4. Lifecycle

**ADR lifecycle** — append-only. An accepted ADR is immutable: in-place edits only
for corrections of form and for clarifications that do not change the decision. A
reversal is a new ADR; the old one keeps its body, and both sides carry the link.
An ADR is never deleted, nor moved. Statuses:

- `Active` — current decision.
- `Superseded by ADR-NNN` — replaced; the new record carries `Supersedes ADR-MMM`.
- `Deprecated` — no longer applies, nothing replaced it.

**Design lifecycle** — a PR introducing user-observable behavior updates
`docs/design/` in the same diff. Design-first when the PR would otherwise be silent.

**Technical doc lifecycle** — same PR as the code, lint rule or behavior it describes.

**Drift detection** — reactive. Triggered by a noticed divergence or a focused audit,
not by a calendar.

### 5. Severe 4-point test

Applies to a new technical doc, a new section, or a change to an existing rule.
Skipped for typos and reformulations. All four required:

1. **Singular concern** — the topic fits one word. `shipping` yes; `security (auth + rate limit + headers)` no.
2. **Not in the code** — it says something types, signatures or migrations do not already say.
3. **No duplicate** — `grep` confirms it exists nowhere else.
4. **A senior dev would write it spontaneously** — remove the doc, hand over the repo, and they would end up writing it because the information is missing.

Fail any one: remove, merge, or rewrite.

### 6. Level of detail

Adaptive: capture every user-observable invariant, no more. Size follows the concept,
not a target length.

Style guards:

1. Tables beat prose whenever the content is a set of (key, value, condition).
2. No paraphrase of the document itself ("as we saw above").
3. No narrative examples ("imagine a customer named Bob").
4. No rule derivable from another rule in the same document.
5. No pedagogy.

**Test**: every line captures an invariant a senior dev cannot infer from the rest of
the document. If it fails, delete the line.

### 7. Format

| Element | Rule |
|---|---|
| Diagrams | Forbidden by default; prefer state-transition tables. Mermaid only when the content cannot be tabular. No ASCII art, no PNG |
| Headings | H1 = title, H2 = sections, H3 = subsections, H4 max. Beyond that, the document is badly structured |
| Cross-references | Standard markdown links. No line numbers |
| File naming | lowercase, kebab-case |
| Code blocks | Source code forbidden — paraphrase instead. Allowed for textual data a user or operator directly produces or consumes: i18n strings, CLI output, sample input. JSON/YAML fixing a wire format or a storage schema is forbidden |
| Emojis | Forbidden |
| Language | English, including in examples |

### 8. Open points

An unresolved question is marked *TBD* inline, in the document that will own the
answer. A design document with no *TBD* claims to be complete, and is read as such.

## Rationale

"Everyone" as an audience means no one: pedagogy for non-technical readers is
directly at odds with the dense style that serves the primary reader.

Over-documentation is the failure mode that matters here. A schema copied into a
document drifts silently from the migration that defines it, and the reader who
trusts it is worse off than the reader who had nothing. The intentional gap between
design and code is what prevents that.

Three document types are enough structure without fragmentation: readers navigate by
topic, not by category.

## Consequences

- Every file under `docs/` belongs to exactly one of the three types.
- Design documents describe behavior; they contain no schema, no signature, no source.
- A new technical document must pass the 4-point test before being created or kept.
- Adding a fourth type requires amending this ADR.
