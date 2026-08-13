# Storefront — Design Specification

The public surface: what it shows, how the merchant makes it theirs, and how search
engines and messaging apps see it.

**Status:** Work in progress.

---

## 1. Pages

| Page | Content |
|---|---|
| Home | Shop identity, a merchant-chosen selection (*TBD: featured categories, latest products, or both*), links to content pages |
| Category | Products of the category and its descendants, with sorting and filters |
| Product | Images, title, description, variant selection, price, availability, add to cart |
| Search results | Same listing behavior as a category, ranked by relevance |
| Content page | A merchant page ([content.md](content.md)) |
| Cart, checkout, account | See [cart-checkout.md](cart-checkout.md), [account.md](account.md) |

Every listing is paginated with a stable sort ([core.md](core.md)).

---

## 2. Identity and theme

A merchant configures, from the back office:

| Setting | Effect |
|---|---|
| Shop name | Page titles, emails, invoices |
| Logo and favicon | Header and browser tab |
| Theme | One of the shipped themes: a coherent set of colours and styles |
| Colour overrides | Primary and accent colours on top of the chosen theme |
| Typography | A choice among shipped font stacks (*TBD: whether custom fonts are uploadable*) |

- Themes change **colours, typography, spacing, radius and elevation. Never layout.**
- Light and dark are both defined by every theme; a visitor's system preference is
  honoured, with an explicit override available.
- A colour override that fails the contrast threshold against its surface is refused
  with an explanation — a merchant cannot make their own shop unreadable by accident.
  The threshold is WCAG 2.2 AA for text and interface elements.

---

## 3. Discoverability

The storefront is rendered in the browser, so metadata is served with the page shell
(ADR 0005) rather than produced by the client.

| Element | Rule |
|---|---|
| URLs | Human-readable slugs for products, categories and pages. A changed slug keeps the old one redirecting |
| Title and description | Per page, derived from its content, overridable per product and category (*TBD: whether v1 exposes the override*) |
| Canonical URL | Every public page declares one |
| Social preview | Title, description and image, so a shared link renders correctly in messaging apps that do not run JavaScript |
| Structured product data | Price, currency, availability and image on product pages |
| Sitemap | Generated, listing published products, categories and pages |
| Robots | Filtered, sorted and paginated listing URLs are excluded from indexing; only categories, products and pages are indexed |

---

## 4. Experience rules

- **Mobile first.** Every page is usable one-handed on a small screen; the desktop layout
  is the enhancement, not the reference.
- **Accessibility is a design requirement**, not a later pass: keyboard reachability,
  visible focus, labelled controls, alternative text on every image, and announcements
  for asynchronous changes such as adding to cart. Target: WCAG 2.2 AA.
- **Loading states are designed**, not spinners bolted on: a listing shows placeholders
  matching its layout, an action blocks its own control rather than the page.
- **Errors are recoverable**: an unavailable variant, an expired code, a refused address
  each say what happened and what to do next, in the visitor's language.
- Prices always display with tax included, consistently with [core.md](core.md).

---

## 5. Performance

The storefront's first meaningful paint depends on one API round trip, which makes
perceived speed a design concern:

- Images are served in a modern format at the size actually displayed
  ([catalog.md](catalog.md)).
- Listing and product data are cacheable, and the back office's assets never load on a
  storefront page.
- A page that is waiting shows its structure, never a blank screen.

Concrete budgets are *TBD* and belong to a frontend technical document once the first
pages exist.

---

## 6. Out of v1

- Merchant-editable home layout or page composition.
- Structural themes and uploadable templates.
- Product reviews, ratings, related-product recommendations.
- Multi-language storefront content.
- Cookie banner — nothing is tracked ([account.md](account.md)).
