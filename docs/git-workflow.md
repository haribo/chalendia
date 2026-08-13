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

GitHub Actions gate every PR. Every gate is also a `just` target, so it is
reproducible locally with the same command — a gate that only exists in CI is a
gate nobody can reproduce.

| Workflow | Job | Covers | Locally |
|---|---|---|---|
| `ci.yaml` | Backend | `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` against a real PostgreSQL, and the committed SQL query cache being current | `just backend-check`, `just backend-test`, `just backend-sqlx-check` |
| `ci.yaml` | Frontend | type check, lint (including accessibility and the theme-token rule), unit tests, production build | `just frontend-check`, `just frontend-test`, `just frontend-build` |
| `ci.yaml` | Container image | the image builds, and refuses to run as root | `just image` |
| `security.yaml` | Gitleaks | secrets in the history | pre-commit hook |
| `security.yaml` | Cargo audit, npm audit | dependency advisories | — |

`just check` runs every code gate in one command.

Not yet gated, and deliberately listed so nobody assumes otherwise:

| Job | Blocked on |
|---|---|
| Generated API contract and frontend types parity | the contract chain landing |
| End-to-end suite | the first real user path |
| Commit message and PR title validation | — |

All existing gates must be green before merge; there is no manual skip.

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
