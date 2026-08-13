# Git workflow

See also: [git-commits.md](git-commits.md) for commit conventions,
[git-issues.md](git-issues.md) for issue conventions.

## Branches

| Branch | Role |
|---|---|
| `main` | Release. Merged from `develop` when a release is cut, deployed from here. |
| `develop` | Integration and default target. All work lands here first. |

Both are permanent — **never push directly, always via PR**.

## Issue-first workflow

Every change starts with a GitHub issue, except trivial changes (typo,
formatting, dependency bump) and the initial bootstrap.

- The issue describes the **what/why**; the PR describes the **how**.
- The branch name includes the issue number for traceability.
- The PR body references the issue with `Closes #N` to auto-close on merge.

```
issue #12 → branch feat/12-cart-merge → PR "Closes #12" → squash merge
```

## Feature workflow

```
/gh-issue                                    # 1. create issue
git checkout -b feat/12-desc develop         # 2. branch from develop
/git-commit                                  # 3. work, commit
git fetch origin && git rebase origin/develop # 4. rebase before PR
/gh-pr-create                                # 5. PR — MUST target develop
gh pr checks                                 # 6. wait for CI
/gh-merge-develop                            # 7. squash merge
```

## Merge strategy

| Target | Strategy | Command |
|---|---|---|
| Feature → `develop` | **Squash** | `/gh-merge-develop` |
| `develop` → `main` | **Merge commit** | `gh pr merge --merge` |

Never merge a feature PR with `--merge`. Never target `main` with a feature PR.

## CI gating

GitHub Actions gate every PR. Today only `security.yaml` (secret scanning) runs,
because there is no application code yet. As the backend and the frontend land,
add their jobs here and describe them in this section — a gate that exists but is
not written down is a gate nobody knows they can rely on.

Planned, in the order they become possible:

| Job | Covers |
|---|---|
| `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` | Rust backend |
| `cargo audit`, `npm audit` | Dependency advisories |
| lint, type-check, unit tests | Vue / TypeScript frontend |
| generated-code parity (OpenAPI types, SQL queries) | Contract drift |
| End-to-end suite | Critical shopper and staff paths |
| PR validation | commit messages, PR title, issue reference |

All must be green before merge; there is no manual skip.

## Rules

- Never push directly to `main` or `develop` — always via PR.
- **Merging `develop`→`main` requires explicit human approval, every time — never autonomous.** A standing "be autonomous" instruction applies to `feature`→`develop` only; it never extends to `main`.
- Chalendia ships continuously; there is no tagged release flow and no `CHANGELOG.md` yet. Add both here the day versions start being published — do not assume either exists.
- One logical change per PR — split unrelated work.
- Keep feature branches short-lived (days, not weeks).
- Rebase on `develop` before opening a PR.
- A PR changing user-observable behavior updates `docs/design/` in the same diff.

## Branch naming

```
feat/12-short-description
fix/34-short-description
refactor/56-short-description
docs/78-short-description
chore/short-description
```

Prefix matches commit type; include the issue number after the slash; kebab-case.
May omit the number for trivial `chore`/`style` without an issue.
Enforced by `.githooks/pre-push`.
