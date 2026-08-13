# Load .env so overriding a port is a one-line edit, not an exported variable.
set dotenv-load := true

backend_dir := "apps/backend"
frontend_dir := "apps/frontend"
log_dir := justfile_directory() / "logs"

# Development ports. Deliberately not the usual 5432 / 8080 / 5173: a developer
# runs several projects on one machine, and a port clash at first launch is a
# terrible first impression. Override in .env if these clash too.
dev_db_port := env("CHALENDIA_DEV_DB_PORT", "5442")
dev_api_port := env("CHALENDIA_DEV_API_PORT", "8090")
dev_web_port := env("CHALENDIA_DEV_WEB_PORT", "5183")

dev_db_url := "postgres://chalendia:chalendia@127.0.0.1:" + dev_db_port + "/chalendia"
compose_dev := "docker compose -f docker-compose.yaml -f docker-compose.dev.yaml"

default:
    @just --list

# =============================================================================
# DEV — everything needed to get a shop running locally
# =============================================================================

# One-time setup: prerequisites, git hooks, .env
dev-setup:
    #!/usr/bin/env bash
    set -euo pipefail
    missing=()
    command -v cargo >/dev/null  || missing+=("rust (https://rustup.rs)")
    command -v node >/dev/null   || missing+=("node (https://nodejs.org/)")
    command -v docker >/dev/null || missing+=("docker (https://docs.docker.com/engine/install/)")
    if [ ${#missing[@]} -gt 0 ]; then
        echo "missing prerequisites:"
        for tool in "${missing[@]}"; do echo "  - $tool"; done
        exit 1
    fi
    docker info >/dev/null 2>&1 || { echo "the docker daemon is not running"; exit 1; }
    git config core.hooksPath .githooks
    if [ ! -f .env ]; then
        cp .env.example .env
        echo "created .env from .env.example"
    fi
    echo "prerequisites present, git hooks enabled"
    echo "next: just dev-start"

# Start the database, apply migrations, run the API and the dev server
dev-start: dev-db
    #!/usr/bin/env bash
    set -euo pipefail
    just _dev-run-api
    just _dev-run-web
    echo ""
    echo "  shop        http://localhost:{{dev_web_port}}"
    echo "  api         http://localhost:{{dev_api_port}}/health"
    echo "  database    localhost:{{dev_db_port}}"
    echo ""
    echo "  logs: just dev-logs   stop: just dev-stop"

# Stop the dev server, the API and the database
dev-stop:
    #!/usr/bin/env bash
    set -euo pipefail
    just _dev-kill web
    just _dev-kill api
    {{compose_dev}} stop database >/dev/null 2>&1 || true
    echo "stopped"

# What is running right now
dev-status:
    #!/usr/bin/env bash
    set -euo pipefail
    for name in api web; do
        pid_file="{{log_dir}}/${name}.pid"
        if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            echo "${name}: running (pid $(cat "$pid_file"))"
        else
            echo "${name}: stopped"
        fi
    done
    if docker compose ps --status running --services 2>/dev/null | grep -qx database; then
        echo "database: running on port {{dev_db_port}}"
    else
        echo "database: stopped"
    fi

# Follow the API and dev server output
dev-logs:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p {{log_dir}}
    touch {{log_dir}}/api.log {{log_dir}}/web.log
    tail -f {{log_dir}}/api.log {{log_dir}}/web.log

# Start the development database and wait until it answers queries
dev-db:
    #!/usr/bin/env bash
    set -euo pipefail
    docker info >/dev/null 2>&1 || { echo "the docker daemon is not running"; exit 1; }
    {{compose_dev}} up -d database
    echo "waiting for postgres on port {{dev_db_port}}..."
    # `pg_isready` answers yes during the image's own init restart, so poll a
    # real query instead: that is what the API will do.
    until docker compose exec -T database psql -U chalendia -d chalendia -c 'select 1' >/dev/null 2>&1; do
        sleep 1
    done
    echo "database ready"

# Wipe the development database and start again from an empty schema
dev-db-reset:
    #!/usr/bin/env bash
    set -euo pipefail
    just dev-stop
    {{compose_dev}} down -v
    just dev-db

# Open a psql shell on the development database
dev-db-shell:
    docker compose exec database psql -U chalendia -d chalendia

_dev-run-api:
    #!/usr/bin/env bash
    set -euo pipefail
    just _dev-guard api {{dev_api_port}}
    mkdir -p {{log_dir}}
    cd {{backend_dir}}
    echo "building the api..."
    DATABASE_URL="{{dev_db_url}}" cargo build --quiet
    DATABASE_URL="{{dev_db_url}}" \
    CHALENDIA_PUBLIC_URL="http://localhost:{{dev_web_port}}" \
    CHALENDIA_BIND="127.0.0.1:{{dev_api_port}}" \
    CHALENDIA_CORS_ORIGINS="http://localhost:{{dev_web_port}}" \
        ./target/debug/chalendia-backend > {{log_dir}}/api.log 2>&1 &
    echo $! > {{log_dir}}/api.pid
    # Migrations run before the listener opens, so a reachable /health proves
    # the schema is in place too.
    for _ in $(seq 1 60); do
        curl -sf "http://127.0.0.1:{{dev_api_port}}/health" >/dev/null 2>&1 && break
        kill -0 "$(cat {{log_dir}}/api.pid)" 2>/dev/null || { echo "the api died on startup:"; tail -5 {{log_dir}}/api.log; exit 1; }
        sleep 0.5
    done
    echo "api started (pid $(cat {{log_dir}}/api.pid), logs → logs/api.log)"

_dev-run-web:
    #!/usr/bin/env bash
    set -euo pipefail
    just _dev-guard web {{dev_web_port}}
    mkdir -p {{log_dir}}
    [ -d {{frontend_dir}}/node_modules ] || (cd {{frontend_dir}} && npm ci)
    cd {{frontend_dir}}
    VITE_API_BASE_URL="http://localhost:{{dev_api_port}}" \
        npm run dev -- --port {{dev_web_port}} --strictPort > {{log_dir}}/web.log 2>&1 &
    echo $! > {{log_dir}}/web.pid
    for _ in $(seq 1 60); do
        curl -sf "http://localhost:{{dev_web_port}}" >/dev/null 2>&1 && break
        sleep 0.5
    done
    echo "dev server started (pid $(cat {{log_dir}}/web.pid), logs → logs/web.log)"

# Refuse to start a second copy rather than leaving an orphan on the port
_dev-guard name port:
    #!/usr/bin/env bash
    set -euo pipefail
    pid_file="{{log_dir}}/{{name}}.pid"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        echo "{{name}} is already running (pid $(cat "$pid_file")). Run 'just dev-stop' first."
        exit 1
    fi
    if ss -ltn 2>/dev/null | grep -q ":{{port}} "; then
        echo "port {{port}} is already in use by something else. Set CHALENDIA_DEV_$(echo {{name}} | tr a-z A-Z)_PORT in .env."
        exit 1
    fi
    rm -f "$pid_file"

_dev-kill name:
    #!/usr/bin/env bash
    set -euo pipefail
    pid_file="{{log_dir}}/{{name}}.pid"
    [ -f "$pid_file" ] || exit 0
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
        # The dev server spawns a child that holds the port; kill the children
        # too or the next start hits a port that is still bound.
        pkill -TERM -P "$pid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
        for _ in $(seq 1 20); do
            kill -0 "$pid" 2>/dev/null || break
            sleep 0.5
        done
        kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"

# =============================================================================
# SETUP
# =============================================================================

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

# =============================================================================
# GATES — what CI runs, runnable locally with the same command
# =============================================================================

# Format and lint the backend. Offline on purpose: the committed query cache is
# what makes linting possible without a database running.
backend-check:
    cd {{backend_dir}} && cargo fmt --check
    cd {{backend_dir}} && SQLX_OFFLINE=true cargo clippy --all-targets -- -D warnings

# Needs a database: the integration tests run against a real one.
backend-test:
    #!/usr/bin/env bash
    set -euo pipefail
    url="${DATABASE_URL:?DATABASE_URL is not set — copy .env.example to .env}"
    # Tests what matters — the database answers — rather than how it was
    # started, so this works the same locally and in CI.
    hostport="${url#*@}"; hostport="${hostport%%/*}"
    host="${hostport%%:*}"; port="${hostport##*:}"
    if ! timeout 2 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null; then
        echo "no database answering on ${host}:${port} — start one with 'just dev-db'"
        exit 1
    fi
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

# =============================================================================
# PACKAGING
# =============================================================================

# Build the container image
image:
    docker build -t chalendia:dev .

# Run the shop the way an operator does: image plus database, nothing else
up:
    docker compose up -d --build

down:
    docker compose down
