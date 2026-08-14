# ADR 0005 — Password storage and sessions

## Status

Active

## Context

The shop holds staff credentials, and later customer ones. Two mechanisms have
to be chosen before the first account exists, because both are painful to change
afterwards: how a password is stored, and how a signed-in caller is recognised.

The design constrains the second one: signing out invalidates the session
everywhere it was usable (`docs/design/core.md` § 3). That single rule decides
more than it looks.

## Decisions

### 1. Passwords are hashed with Argon2id

Per-password random salt, parameters recorded in the hash string so a later
reader knows what produced it, and a verification that runs in constant time
with respect to the password.

Parameters follow the OWASP recommendation current at adoption; they live in one
place in the code, and raising them is a code change, not a configuration knob —
an operator lowering a security parameter by environment variable is a footgun,
not a feature.

A password is never logged, never returned by any route, and never compared as a
string.

### 2. Sessions are opaque tokens stored server-side

A random token is issued to the browser; its **hash** is stored, alongside the
account it belongs to and its expiry. The token itself is never stored, so a
database copy does not yield usable sessions.

The token travels in a cookie: `HttpOnly`, `SameSite=Lax`, `Secure` whenever the
shop's public URL is HTTPS, scoped to the site's own path.

### 3. Not JWT

The design requires that signing out invalidates a session everywhere. A
self-contained token cannot be invalidated before it expires without a
server-side list of revoked tokens — at which point the server is doing a lookup
anyway, and has traded a simple table for a table plus a signature scheme.

### 4. Expiry is absolute, and renewed by use

A session dies at a fixed distance from its last use. Idle sessions expire
without anyone acting; active work is not interrupted mid-task. Exact durations
live in the code, not in this ADR, so they can be tuned without a decision
record — but they are not operator-configurable in v1.

### 5. Authorization is checked per route, on the server

The route asks the session what it is allowed to do. The interface's own guard
exists to avoid offering what would be refused, never to protect anything.

Every restricted route has a test proving refusal, per ADR 0003.

## Rationale

- **Argon2id** is the current recommendation of both OWASP and the IETF for
  password storage; it is memory-hard, which is what makes a stolen database
  expensive to attack rather than merely slow.
- **Opaque tokens** cost one indexed lookup per request, on a database the
  request is about to use anyway. That is the entire price, and it buys instant
  revocation, session listing, and the ability to end a session from another
  device — all of which JWT charges extra for.
- **Storing the hash rather than the token** means a leaked backup contains no
  usable session, the same reason passwords are hashed.

## Alternatives considered

- **bcrypt** — acceptable, and rejected for being not memory-hard: it resists a
  GPU far less well than Argon2id at comparable cost.
- **JWT with short expiry and refresh tokens** — rejected, per § 3. It solves a
  problem this project does not have (stateless horizontal scaling) at the cost
  of one it does (immediate revocation).
- **Session in an encrypted cookie**, no server state — rejected for the same
  reason, plus it makes the cookie grow with what it carries.
- **Operator-tunable hashing parameters** — rejected. The only realistic use is
  lowering them to make a slow machine feel faster, which silently weakens every
  password in the shop.

## Consequences

- Sessions are rows: they are listable, revocable, and countable. Expired ones
  need periodic removal, which is a job this project does not have yet — until
  it does, expiry is enforced on read and stale rows are harmless.
- A password check costs deliberate CPU time. That is the point, and it makes
  sign-in a route worth rate-limiting rather than one to optimise.
- Raising the Argon2 parameters later re-hashes each password on its next
  successful sign-in; the stored parameters make that upgrade path readable.
