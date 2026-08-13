# Content pages — Design Specification

The pages a merchant writes: legal texts, delivery terms, about, and anything else they
need.

**Status:** Work in progress.

---

## 1. Pages

- A page has a title, a body, a URL slug, and a published or draft state.
- The body is written in a rich-text editor producing structured content: headings,
  paragraphs, lists, links, emphasis, images from the shop's own library. Arbitrary HTML
  and embedded scripts are not accepted — a shop must not become an injection surface
  because a merchant pasted a widget.
- Slugs are merchant-editable, unique, and validated. Changing a published page's slug
  keeps the old address working as a redirect, so links already shared do not break.
- Pages are written in the shop content language.

---

## 2. Required legal pages

The shop ships with drafts for the pages a merchant legally needs, in the shop content
language:

| Page | Content shipped |
|---|---|
| Terms of sale | Template with placeholders for the merchant's identity and terms |
| Legal notice | Template |
| Privacy policy | Template describing what Chalendia itself stores |
| Delivery and returns | Template |

Every template is explicitly marked as a non-binding example to be reviewed by the
merchant. Chalendia does not provide legal advice, and the back office says so where the
templates are edited.

Checkout links to the terms of sale, which the customer accepts explicitly
([cart-checkout.md](cart-checkout.md)). A shop whose terms page is still an unedited
template is warned in the back office.

---

## 3. Navigation

- The merchant chooses which pages appear in the footer and in which order.
- Category navigation is built from the category tree
  ([catalog.md](catalog.md)); pages do not appear in it.
- A page not linked anywhere remains reachable by its URL.

---

## 4. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| Create, edit, publish, unpublish pages | Yes | Yes |
| Reorder footer links | Yes | Yes |
| Delete a page | Yes | Yes |

Deleting a page that has ever been published leaves its address redirecting to the
storefront home rather than returning nothing.

---

## 5. Out of v1

- A blog, articles, feeds.
- Scheduled publication.
- Page revision history and rollback.
- Merchant-editable email templates — see [notifications.md](notifications.md).
- Multi-language pages.
