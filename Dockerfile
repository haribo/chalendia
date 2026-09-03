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
# The AVIF encoder's `asm` feature builds its assembly paths with nasm, and
# refuses to build without it (docs/backend/adr/0008-image-pipeline.md). A build
# dependency only: the runtime stage below carries none of it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nasm \
    && rm -rf /var/lib/apt/lists/*
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

# The mount point of the media volume, owned by the user that writes to it: a
# volume Docker creates for a path that does not exist belongs to root, and the
# shop would fail on the first upload rather than at startup.
RUN install -d -o chalendia -g chalendia /srv/chalendia/media

USER chalendia
WORKDIR /srv/chalendia

ENV CHALENDIA_BIND=0.0.0.0:8080 \
    CHALENDIA_STATIC_DIR=/srv/chalendia/static \
    CHALENDIA_MEDIA_DIR=/srv/chalendia/media \
    RUST_LOG=info

EXPOSE 8080

CMD ["chalendia-backend"]
