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
| Country | **One per shop**, where it is established. Decides which VAT rates apply and what the legal identity must carry |
| Currency | **One per shop.** No switcher, no conversion, no display-only rates |
| Content language | **One per shop.** The language merchants write products and pages in |
| Interface languages | English and French, chosen by each user |
| Timezone | Used for every displayed timestamp and for deadline computation |
| VAT | Enabled or disabled; when enabled, a list of rates |
| Price entry mode | Prices are entered and displayed **tax-inclusive** |

Changing the currency after the first order is refused: past orders and invoices carry
amounts in the currency they were issued in, and reinterpreting them would falsify
accounting records.

### Where they are changed

Staff change all of this in the back office's **Settings** section, which keeps apart two
things that are otherwise constantly confused:

- **Your preferences** — the interface language and the theme. They belong to the person
  and not to the shop: two staff members administering the same shop each have their own,
  and changing one changes nothing for customers or colleagues. They apply as soon as they
  are chosen, so nothing on that page is saved by a button.
- **The shop** — everything in the table above. It is the same for everyone who
  administers the shop, and only an administrator may change it.

The Settings page also names who is signed in. It is the one surface where that address is
read rather than acted on, which is why it appears there and nowhere else in the back
office.

Before a session exists — setup, sign-in — the interface language and the theme stay in
the bar of those screens: there is no Settings page to reach yet.

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
- **The rates are those of the shop's country**, not of the customer's. A shop charges
  the VAT of where it is established, which is what the law allows below the
  cross-border thresholds a self-hosted shop rarely reaches. Above them the merchant
  needs an accountant and a declaration, not a setting — see the exclusions below.
- A rate has a **name and a percentage**, because "20 %" is not what a merchant looks
  for in a list; one of them is the shop default.
- A rate that is assigned to a product cannot be deleted. It is refused with **how many**
  products carry it: a shop can have two hundred on one rate, and a list of them where a
  sentence is expected is a list nobody reads. The merchant moves them to another rate,
  then removes it.
- Each product carries one rate from that list. A product with no rate assigned uses
  the shop default rate.
- Entered prices include tax. The tax amount is derived, not added.
- Tax is computed **per rate**, on the summed net amount of the lines carrying it, then
  rounded. It is not computed per line and summed.
- Shipping carries its own rate (*TBD: default is the shop default rate; confirm
  against merchant practice*).
- **Changing a rate's percentage moves every product carrying it.** A product points at
  a rate, not at a number: a merchant correcting a rate that changed by law expects the
  catalogue to follow, and copying the number onto each product is how half of them stay
  wrong. Orders and invoices already issued are the exception below.
- Changing a rate never alters existing orders or issued invoices.

When VAT is **off**, no screen shows a tax amount, and the storefront carries the legal
mention that VAT is not applicable — on the product page, in the cart, and on the order
documents, since that is where a customer looks for it. The exact wording is the
merchant's, since it names the article of law they rely on (*TBD: a default text per
country, or an empty field the merchant must fill*).

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

### Narrow screens

Every surface is usable on a phone. On a 400 px viewport:

- the page never scrolls sideways — content reflows inside the width it is given;
- no control is covered by another, and every action stays reachable;
- what is hidden to save room is hidden behind a control that says so, never behind a
  scroll the visitor has to discover.

The back office **adapts** below 768 px rather than shrinking. The section navigation
and the account actions — who is signed in, back to the shop, sign out — move into a
drawer opened from a single button in the bar; the bar keeps the surface title, the
language and the theme. The drawer closes on Escape, on a press outside it, and on
choosing a section. While it is open, it holds the focus, and the page behind it does
not scroll. Above 768 px the sections stay permanently visible and no drawer exists.

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
