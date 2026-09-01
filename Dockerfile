# One image, one process: the API binary carries its migrations and serves the
# built frontend. An operator installs a shop with a database and this.

# --- frontend ---------------------------------------------------------------
FROM node:26-alpine AS frontend

WORKDIR /build
COPY apps/frontend/package.json apps/frontend/package-lock.json ./
RUN npm ci
COPY apps/frontend/ ./
RUN npm run build

# --- backend ----------------------------------------------------------------
FROM rust:1.98-slim-trixie AS backend

WORKDIR /build
COPY apps/backend/ ./
# Queries are verified against the committed cache: the build reaches no
# database, and a stale cache fails here rather than in production.
ENV SQLX_OFFLINE=true
RUN cargo build --release --locked

# --- runtime ----------------------------------------------------------------
FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 chalendia

COPY --from=backend /build/target/release/chalendia-backend /usr/local/bin/chalendia-backend
COPY --from=frontend /build/dist /srv/chalendia/static

USER chalendia
WORKDIR /srv/chalendia

ENV CHALENDIA_BIND=0.0.0.0:8080 \
    CHALENDIA_STATIC_DIR=/srv/chalendia/static \
    RUST_LOG=info

EXPOSE 8080

CMD ["chalendia-backend"]
