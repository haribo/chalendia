# Pull Request

Run local checks, push, and create a PR targeting `develop`.

Accepts an optional argument: PR title. If not provided, generate one from commits.

## Instructions

### 1. Validate branch

- Run `git branch --show-current`
- If on `main` or `develop`: **refuse** — must be on a feature branch

### 2. Resolve issue reference

- Extract issue number from the branch name: convention is `type/NUMBER-description` (e.g., `feat/59-slot-booker-org-roles` → `#59`)
- Parse the number immediately after the first `/`
- If no issue number found and the PR title does NOT start with `chore` or `style`: **refuse** — ask the user to provide the issue number
- If the PR title starts with `chore` or `style`: skip — no issue reference required (matches CI exemption)
- **Epic batching** (2026-07-26): one PR MAY close several sibling sub-issues of the same epic (`Closes #a` + `Closes #b`…) when ALL hold: (a) they were designed/mocked together and validated as one block, (b) each is individually low-risk or proven inert, (c) none has its own pending visual validation. Never across epics; never bug fixes mixed with features. Name the branch after the epic or the first sub-issue.

### 3. Run local checks — fail on first violation, do NOT push if any step fails

#### 3.1 Lint + typecheck

- Backend: `just backend-check`
- Frontend: `just frontend-check`

#### 3.2 Unit tests

- Backend: `just backend-test`
- Frontend: `just frontend-test`

A step whose `just` target does not exist yet (the app has not landed) is skipped —
state it explicitly in the conversation. A step that exists is never skipped.

#### 3.3 E2E — any change that can affect a user-observable flow

Any modification to frontend OR backend code that can affect a user-observable behavior: `just e2e`.

Only exemptions:

- Pure refactor with provably identical output (and the proof is referenced in the PR — e.g., snapshot tests, no diff in generated artifacts).
- Doc-only changes (`docs/**`, `CLAUDE.md`, `.md` files outside of code).
- Config-only changes that do not alter runtime behavior (e.g., editor config, CI workflow tweaks).
- **Proven-inert additions** (2026-07-26): every new file has zero production consumers (grep of its imports pasted in the PR body as proof), the ONLY touches to existing files are barrel re-exports or lint-config allow-lists, and lint + typecheck + full unit are green. One line beyond that in an existing file → the full suite runs, no debate. This is a mechanical proof, not a judgment call.

Any other case — including backend changes that touch handlers, services, or data flow — runs the e2e suite. Subjective claims like "this component is not e2e-covered" are NOT a valid skip; the gate runs the suite and lets the suite decide.

#### Pre-existing failures — fail closed

If a test (unit or e2e) fails on code unrelated to this PR (pre-existing regression on `develop`), the gate STILL fails. Do NOT bypass. Open a separate issue documenting the pre-existing failure and stop the push. The current PR proceeds only after the pre-existing failure is fixed or explicitly tracked and acknowledged by the user.

#### 3.4 Test-up-to-date — HARD STOP, answer with evidence in the conversation

Two acceptable answers:

(a) "Existing tests cover the change" — quote spec file path(s) + grep output of the assertion.
(b) "Tests added in this PR" — list spec files in `git diff develop...HEAD --name-only | grep spec`.

UNACCEPTABLE (treated as failure): "manually verified", "lint passes", "I think so", "no test required", silence.
If no acceptable answer: STOP, add tests, re-run § 3.1–3.3, retry the question.

The "no test required" justification is intentionally removed. The only legitimate cases (pure refactor, doc-only, config-only) are already covered by § 3.3 exemptions and produce no user-observable change to test. Anything that requires "no test because <reason>" wording is a misuse of the gate.

### 4. Prepare PR content

Run in parallel:
- `git log --oneline develop..HEAD` to see all commits
- `git diff develop...HEAD --stat` to see changed files

Analyze all commits and draft:
- **Title**: `type(scope): description` format (under 70 chars), no `(#N)` suffix — it is appended on squash merge. Use argument if provided.
- **Body**: summary bullets + test plan + `Closes #N` (if issue number was resolved in step 2)

### 5. Push and create PR

- Push with `git push -u origin <branch>`
- Create PR:

```
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Test plan
<bulleted checklist>

Closes #<N>
EOF
)"
```

Omit the `Closes #<N>` line for `chore`/`style` PRs (no issue reference).

### 6. Output

Return the PR URL.
