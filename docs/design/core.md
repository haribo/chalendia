# Core — Design Specification

Source of truth for shop identity, roles, authentication, money, tax, language, and
the conventions every domain inherits. Domain behavior lives in the matching file
under `docs/design/`.

**Status:** Work in progress. Perimeter fixed by [ADR 0004](../adr/0004-v1-release-scope.md).

---

## 1. Product model

Chalendia is a **self-hosted online shop**. One installation is one shop, run by one
merchant.

- **What it sells.** Physical products with variants. Digital goods and services are
  out of v1.
- **Who buys.** Anyone who creates a customer account. No guest checkout.
- **Who runs it.** A merchant and their staff, through a back office on the same
  installation.
- **Who installs it.** The merchant or someone acting for them. The operator is a
  first-class user, and installation behavior is designed, not improvised — see
  [installation.md](installation.md).

Design describes **user-observable** rules. Framework, table and field choices belong
to code.

---

## 2. Roles

One account identity per person. Capabilities differ by role.

| Role | Can |
|---|---|
| **Customer** | Register, browse, buy, manage their account, addresses, orders and personal data |
| **Operator** | Everything a shop needs day to day: catalog, attributes, categories, stock, orders, fulfillment, shipping labels, content pages, promotions |
| **Administrator** | Everything an operator can, plus shop settings, tax rates, payment and carrier credentials, theme and identity, staff accounts |

Invariants:

- Staff roles are granted by an administrator, never self-assigned.
- An administrator cannot remove their own administrator role if they are the last one.
- Staff use the same credentials on both surfaces; moving between storefront and back
  office is explicit navigation, not an implicit dual interface.
- A staff member is not a customer by construction: buying requires a customer account,
  which any staff identity may also have.
- Every restriction is enforced by the API. Interface hiding is a convenience.

Custom permission matrices are out of v1.

---

## 3. Authentication

| Mechanism | v1 |
|---|---|
| Email and password | Yes |
| Email verification | Required before any purchase |
| Password reset by email | Yes |
| OAuth providers | No |
| Two-factor authentication | No |

- Email is the login identifier, unique per shop, normalized to lowercase.
- Until the address is verified, the account may browse and hold a cart but cannot
  place an order. Verification is re-sendable, with a bounded number of attempts.
- Password rules follow current guidance: **at least 12 characters**, no composition
  rules, no forced rotation, and rejection of known-breached passwords (*TBD: breach
  check source, and whether it is optional for offline installs*). Length is the only
  requirement stated to the user, and it is stated before they submit.
- **The first administrator is created at setup and is verified by construction**: the
  shop cannot send mail before it is configured, so requiring a verification the
  operator could not receive would lock them out of their own installation. Every
  account created afterwards follows the normal rule.
- Sessions expire; the exact lifetime and renewal behavior is *TBD* and belongs to a
  backend decision, not to design, except for two user-observable rules: signing out
  invalidates the session everywhere it was usable, and an expired session sends the
  user to sign in and then back to the page they were going to, with nothing they had
  already entered silently lost.
- Login, registration, password reset and payment attempts are rate-limited. A
  rate-limited user is told, in their language, that they must wait — never silently
  failed.

Authentication failures never disclose whether an address exists. Registration with an
existing address sends a message to that address rather than reporting the collision
to the visitor. A failed sign-in says the address and password do not match — never
which of the two is wrong.

Setup runs **once**. Once a shop is configured, the setup route is refused by the shop
itself, not merely hidden by the interface: an installation reachable before setup
completes can be claimed by whoever gets there first, and that window closes for good.

---

## 4. Shop settings

Set at installation, editable by an administrator afterwards.

| Setting | Rule |
|---|---|
| Shop name, logo, favicon | Displayed on the storefront and in emails |
| Contact and legal identity | Required for invoices and legal pages |
| Currency | **One per shop.** No switcher, no conversion, no display-only rates |
| Content language | **One per shop.** The language merchants write products and pages in |
| Interface languages | English and French, chosen by each user |
| Timezone | Used for every displayed timestamp and for deadline computation |
| VAT | Enabled or disabled; when enabled, a list of rates |
| Price entry mode | Prices are entered and displayed **tax-inclusive** |

Changing the currency after the first order is refused: past orders and invoices carry
amounts in the currency they were issued in, and reinterpreting them would falsify
accounting records.

---

## 5. Money

- Amounts are held as **integer minor units** of the shop currency. No floating point
  anywhere in the pricing path.
- Every displayed amount is formatted per the user's interface locale, with the shop
  currency's symbol and precision.
- **Rounding**: half-up, to the minor unit, applied once per computed total — never
  cumulatively across intermediate values.
- Line total is unit price times quantity, then discounts, then rounding. The order is
  fixed so two implementations cannot disagree by a cent.
- An order's stored totals are authoritative once placed. A later price change never
  alters a placed order.

---

## 6. Tax

- VAT is either **off** (the shop shows a legal notice that VAT is not applicable) or
  **on** with a list of merchant-defined rates.
- Each product carries one rate from that list. A product with no rate assigned uses
  the shop default rate.
- Entered prices include tax. The tax amount is derived, not added.
- Tax is computed **per rate**, on the summed net amount of the lines carrying it, then
  rounded. It is not computed per line and summed.
- Shipping carries its own rate (*TBD: default is the shop default rate; confirm
  against merchant practice*).
- Changing a rate never alters existing orders or issued invoices.

Destination-based rates, OSS/IOSS thresholds, B2B reverse charge and per-country
matrices are out of v1.

---

## 7. Languages

Three kinds of text, three mechanisms.

| Kind | Examples | Who provides it | Translated |
|---|---|---|---|
| Interface strings | Menu labels, buttons, validation messages, email templates | The project, shipped with the release | English and French |
| Merchant content | Product titles and descriptions, category names, pages | The merchant | No — written in the shop content language |
| User data | Addresses, order notes | The customer | No |

- A visitor chooses their interface language; the choice persists across sessions.
- The storefront shows no content-language switcher, because merchant content exists in
  one language only.
- Emails are sent in the recipient's interface language, with merchant content embedded
  as written.
- The data model reserves room for translated merchant content so a later version can
  add it without a breaking change. Nothing in v1 exposes it.

---

## 8. Cross-cutting conventions

### Lists

Every list that can grow is paginated server-side with a bounded page size and a stable
default sort. No endpoint returns an unbounded collection.

### Errors

User-visible errors are actionable and localized. Validation errors attach to the field
that caused them. A failure the user cannot act on says what happened and what to do
next, never an internal identifier alone.

### Time

Timestamps are stored in UTC and displayed in the shop timezone. Deadlines visible to
users (payment expiry, reservation release) are computed in the shop timezone.

### Addresses

An address is captured with an explicit country and is normalized on save (trimmed,
consistent casing). Postal validation beyond format is out of v1; the shipping domain
may reject an address the carrier refuses.

### Audit

Actions that move money or change staff access are recorded with actor, timestamp and
target. Detail and retention are *TBD*.

### Deletion

No user-facing destructive action is irreversible without a confirmation naming what
will be lost. Records referenced by an order are never hard-deleted; they are retired
from the catalog and stay readable from the orders that carry them.

---

## 9. Domain index

| Domain | File |
|---|---|
| Terminology | [terminology.md](terminology.md) |
| Catalog | [catalog.md](catalog.md) |
| Inventory | [inventory.md](inventory.md) |
| Cart and checkout | [cart-checkout.md](cart-checkout.md) |
| Payments | [payments.md](payments.md) |
| Shipping | [shipping.md](shipping.md) |
| Orders and invoices | [orders.md](orders.md) |
| Promotions | [promotions.md](promotions.md) |
| Customer account | [account.md](account.md) |
| Content pages | [content.md](content.md) |
| Storefront, theme and SEO | [storefront.md](storefront.md) |
| Notifications | [notifications.md](notifications.md) |
| Installation and setup | [installation.md](installation.md) |
