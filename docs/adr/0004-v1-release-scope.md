# ADR 0004 — v1 release scope

## Status

Active

## Context

Chalendia is a self-hosted shop published under AGPL-3.0 (ADR 0002) for small
merchants who install it themselves. A previous specification attempt covered
physical goods, digital downloads, bookable services, returns, credit notes, a CMS
with a blog, themes and multi-language catalogs — before a single order had ever been
placed. That perimeter was abandoned as unshippable.

This ADR fixes what the first usable release contains. "Usable" means a merchant can
install Chalendia, load a catalog, take a real order, get paid, ship it, and issue an
invoice — without touching a database or a terminal after setup.

Scope decisions were taken in a design session on 2026-08-12/13. This ADR is their
canonical record; the design documents describe the resulting behavior.

## Decisions

### 1. Target user

One installation serves **one merchant, one shop**. The operator is a small merchant
who self-hosts, or someone doing it for them. Chalendia must run on the cheapest
server such a merchant will accept, and must not require a second runtime beside the
API and PostgreSQL.

### 2. In scope

| Domain | What v1 delivers | Design |
|---|---|---|
| Catalog | Physical products with variants, configurable attributes, category tree (3 levels), sorting, full-text search, faceted filters, images in three derived sizes | [catalog.md](../design/catalog.md) |
| Inventory | Stock per variant, reservation while payment is pending, release on expiry | [inventory.md](../design/inventory.md) |
| Cart & checkout | Anonymous cart in the browser, merged into the account cart on sign-in, account required to order | [cart-checkout.md](../design/cart-checkout.md) |
| Accounts | Customer account with verified email, addresses, order history, data export and deletion | [account.md](../design/account.md) |
| Staff | Two roles: administrator and operator | [core.md](../design/core.md) |
| Payments | Bank transfer (offline, marked paid by staff) and Stripe Checkout | [payments.md](../design/payments.md) |
| Shipping | Flat-rate manual method, and one carrier integration with live rates, label generation and tracking | [shipping.md](../design/shipping.md) |
| Orders | Order lifecycle through payment, fulfillment and delivery; immutable PDF invoice | [orders.md](../design/orders.md) |
| Tax | Configurable VAT rates assigned per product; VAT can be switched off entirely | [core.md](../design/core.md) |
| Promotions | Time-bounded sale price, and single-use-per-order discount codes | [promotions.md](../design/promotions.md) |
| Content | Merchant-editable pages with legal templates | [content.md](../design/content.md) |
| Storefront | Shop identity, colour and style themes, SEO essentials | [storefront.md](../design/storefront.md) |
| Notifications | Transactional email over SMTP | [notifications.md](../design/notifications.md) |
| Installation | Docker image and compose file, guided first-run setup | [installation.md](../design/installation.md) |

Interface language: **English and French**. Catalog and page content: **one language
per shop**, declared at setup.

### 3. Out of scope

Each line is a decision, not an oversight.

| Excluded | Reason |
|---|---|
| Digital products (downloads, licences) | Separate domain: file storage, expiring links, entitlement |
| Services and bookable slots | Separate domain: calendar, capacity, scheduling |
| Returns, refunds and credit notes | After-sales handled outside the application in v1; the invoice rules are written so credit notes can be added without contradiction |
| Guest checkout | One purchase path only; the account guarantees a reachable contact |
| OAuth sign-in and two-factor authentication | Email and password only in v1 |
| Multi-currency | One currency per shop |
| Multi-language catalog and pages | Interface is translated; merchant content is not |
| Carrier aggregators, parcel-shop delivery | One direct carrier integration; the interface accepts others later |
| Weight or price shipping grids | Carrier rates or a flat rate |
| EU tax engine (OSS/IOSS, B2B VAT, reverse charge) | Manual rates only |
| Conditional promotion rules, stackable codes | One code per order, no rule engine |
| Blog, customer reviews, wishlists | Content and social domains, deferred |
| Structural themes, layout editor | Themes change colours and styles, never layout |
| Object storage for images | Local disk; the storage layer is single-entry so it can be added |
| Multi-vendor marketplace, multiple shops per install | One install is one shop |
| In-app notification centre, marketing email | Email is the only channel; transactional only |

### 4. Cross-cutting prerequisites

These are not features but are required by several domains, and are therefore built
before or with the first domain that needs them:

| Prerequisite | Required by |
|---|---|
| Attribute system (typed attributes and allowed values) | Variants, faceted filters |
| Money and tax computation with a single rounding rule | Cart, orders, invoices, promotions |
| Immutable document numbering (gapless, per document type) | Invoices |
| Image pipeline (derived sizes at upload, original retained) | Catalog, content |
| Transactional email sending with templates in two languages | Accounts, orders, shipping |
| Role-based authorization on every staff route | All staff surfaces |

### 5. Sequencing

The first vertical slice is deliberately narrow: catalog with variants, cart,
account, order with bank-transfer payment, flat-rate shipping, invoice. Stripe
Checkout and the carrier integration land next, because both depend on external
accounts and neither can be exercised in CI without one. Faceted filters, themes and
promotions land after the order path is proven end to end.

Sequencing is guidance, not a contract: the order may change, the perimeter may not.

## Consequences

- An issue proposing work outside § 2 must either amend this ADR with justification,
  or be labelled for a later version.
- The excluded rows are answers, not open questions. "Why doesn't it do returns?"
  resolves here.
- Domains excluded from v1 still constrain v1 design where a later addition would
  otherwise require a breaking change — invoices are immutable so credit notes fit,
  shipping methods are a configurable list so a second carrier fits, images go through
  one storage entry point so remote storage fits.
- No public release date is announced (ADR 0003).
