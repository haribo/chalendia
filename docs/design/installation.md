# Installation and setup — Design Specification

What the person installing Chalendia does, sees, and is responsible for.

**Status:** Work in progress.

---

## 1. Delivery

- Chalendia ships as a **container image** plus a reference compose file describing the
  application and its PostgreSQL database.
- The same binary runs without a container for operators who prefer that, with the same
  configuration.
- Configuration is by environment variables; a documented example file lists every
  variable, its default, and whether it is required.
- The image carries the frontend assets: one service serves the API and the application.

---

## 2. First start

- On first start, the shop applies its database schema itself. No migration command is
  ever asked of the operator.
- With no shop configured, every request leads to the **setup screen**, which is the only
  thing the installation serves until it completes.

The setup screen collects, in one pass — one page, not a sequence of steps: eight
fields are read faster than they are walked through.

| Group | Collected |
|---|---|
| The shop | Name, legal identity |
| Locale | Currency, timezone, content language |
| Tax | Whether the shop charges VAT — **rates are set afterwards**, with the rest of the settings |
| The account | Administrator email and password |

- Timezone and content language are proposed from the browser. The currency is not
  guessed: it is the one choice that stops being reversible.
- The screen carries the language and theme controls and nothing else — no navigation,
  no footer, and no welcome text. An operator must be able to read the screen in their
  language before answering it.
- Completing setup creates the first administrator, marks the shop configured, and closes
  the setup screen permanently. Reaching its address afterwards says so, and offers to
  sign in.
- No password is generated into logs, and no default credentials exist. An installation
  that is reachable before setup completes can be claimed by whoever reaches it first —
  which the documentation states plainly, because it is the operator's window of risk.
- Everything collected at setup is editable afterwards, except the currency once the
  first order exists ([core.md](core.md)).

---

## 3. Operator responsibilities

Stated in the documentation, not implied:

| Responsibility | Why it is not the product's |
|---|---|
| HTTPS termination | The shop expects a reverse proxy in front; it never serves its own certificates |
| Database backups | The shop owns no backup schedule and no off-site storage |
| Email deliverability (SPF, DKIM, DMARC) | Depends on the operator's domain and DNS |
| Carrier and payment provider contracts | The merchant's own commercial agreements |
| Publishing modified sources | Required by the licence when a modified version is served over a network (ADR 0002) |

The shop refuses to start rather than run without a configured database, and says which
variable is missing.

---

## 4. Health and diagnosis

- A health endpoint reports whether the application is up and whether its database is
  reachable, for use by the operator's own supervision. It sits with the rest of the
  API, under its prefix, not at the root of the shop.
- The back office shows a diagnosis view: pending configuration (no payment method, no
  shipping method, untouched legal templates), failed emails, and failed carrier calls.
  A shop that cannot take an order says so before a customer discovers it.
- Logs are structured, with a configurable level, and never contain credentials, card
  data, session tokens or full personal addresses.

---

## 5. Upgrades

- Upgrading is pulling a newer image and restarting; schema changes apply at startup.
- Migrations are forward-only. Downgrading to a previous image after a schema change is
  not supported, and the release notes say when a version changes the schema.
- A migration that fails aborts startup, leaving the previous state intact rather than a
  half-applied schema.
- Breaking changes for operators (a removed variable, a new required one) are listed in
  the release notes.

---

## 6. Out of v1

- Distribution packages, one-line installers, hosted-provider templates.
- Automatic backups or restore from the back office.
- Built-in HTTPS or certificate management.
- Multiple shops per installation.
- Zero-downtime rolling upgrades.
