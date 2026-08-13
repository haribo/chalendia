default:
    @just --list

backend_dir := "apps/backend"
frontend_dir := "apps/frontend"

# --- setup ---

# Enable the repository's git hooks — run once per clone
hooks-install:
    git config core.hooksPath .githooks
    @echo "hooks enabled: $(git config core.hooksPath)"

# Check whether this clone actually runs the repository's hooks
hooks-check:
    @test "$(git config core.hooksPath)" = ".githooks" \
      && echo "ok: hooks are active" \
      || (echo "INACTIVE: run 'just hooks-install' — every hook here is inert"; exit 1)

# Install frontend dependencies
frontend-install:
    cd {{frontend_dir}} && npm ci

# --- development ---

# Run the API against the database from .env
backend-dev:
    cd {{backend_dir}} && cargo run

# Run the frontend dev server
frontend-dev:
    cd {{frontend_dir}} && npm run dev

# Start a PostgreSQL for development, matching the compose defaults
db-dev:
    docker compose up -d database

# --- gates: what CI runs, runnable locally ---

# Format, lint and query-cache parity for the backend
backend-check:
    cd {{backend_dir}} && cargo fmt --check
    cd {{backend_dir}} && cargo clippy --all-targets -- -D warnings
    cd {{backend_dir}} && SQLX_OFFLINE=true cargo check --all-targets

backend-test:
    cd {{backend_dir}} && cargo test

# Regenerate the committed query cache — run after changing any SQL
backend-sqlx-prepare:
    cd {{backend_dir}} && cargo sqlx prepare -- --all-targets

# Fail when the committed query cache no longer matches the queries
backend-sqlx-check:
    cd {{backend_dir}} && cargo sqlx prepare --check -- --all-targets

frontend-check:
    cd {{frontend_dir}} && npm run typecheck
    cd {{frontend_dir}} && npm run lint

frontend-test:
    cd {{frontend_dir}} && npm run test

frontend-build:
    cd {{frontend_dir}} && npm run build

# Everything a pull request must pass, in one command
check: backend-check backend-test frontend-check frontend-test frontend-build

# --- packaging ---

# Build the container image
image:
    docker build -t chalendia:dev .

# Bring the whole shop up: database and application
up:
    docker compose up -d --build

down:
    docker compose down
