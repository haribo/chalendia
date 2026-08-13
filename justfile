default:
    @just --list

# Enable the repository's git hooks — run once per clone
hooks-install:
    git config core.hooksPath .githooks
    @echo "hooks enabled: $(git config core.hooksPath)"

# Check whether this clone actually runs the repository's hooks
hooks-check:
    @test "$(git config core.hooksPath)" = ".githooks" \
      && echo "ok: hooks are active" \
      || (echo "INACTIVE: run 'just hooks-install' — every hook here is inert"; exit 1)

# Application targets (backend-check, frontend-check, e2e, ...) are added
# with the code they check. A target that does not exist is a gate that
# nobody can run — do not declare one ahead of its app.
