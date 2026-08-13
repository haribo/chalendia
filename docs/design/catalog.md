# Catalog — Design Specification

Products, variants, attributes, categories, images, and how a shopper finds them.

**Status:** Work in progress.

---

## 1. Products and variants

A **product** is what the customer sees: one page, one title, one description, one set
of images, one tax rate. A **variant** is what they buy.

- Every product has at least one variant. A product with no attributes has exactly one,
  invisible as a choice.
- A variant is defined by one value for each of the product's variant-defining
  attributes. Two variants of a product never carry the same combination.
- A variant carries: price, optional sale price, stock, weight, dimensions
  (*TBD: required only when the carrier integration needs them*), merchant reference,
  and optionally its own images.
- Price is per variant. A product shows the lowest current price of its available
  variants, with an indication when variants differ.

### Publication states

| State | Visible on storefront | Buyable | Kept in existing orders |
|---|---|---|---|
| Draft | No | No | n/a |
| Published | Yes | Yes, subject to stock | Yes |
| Retired | No | No | Yes |

A product referenced by any order is never deleted; it is retired. Order lines keep the
title, reference and price captured at purchase, so a retired product never changes what
a past order says.

---

## 2. Attributes

Attributes are defined once for the shop, by staff, and reused across products.

- An attribute has a name and a controlled list of allowed values. Free text is not an
  attribute value: uncontrolled values make filters unusable.
- An attribute is either **variant-defining** (size, colour) or **descriptive**
  (material, origin). Both can be filtered on; only variant-defining ones multiply
  variants.
- Attribute values have an explicit display order, set by staff. Sizes sort as the
  merchant means them, not alphabetically.
- Renaming a value updates it everywhere; deleting a value in use is refused, with the
  list of products using it.

---

## 3. Categories

- A tree, at most **three levels** deep. A product belongs to one or more categories.
- A category page shows the products of that category **and of all its descendants**.
- Categories have an explicit order among siblings, chosen by staff.
- A category with products or children cannot be deleted; it can be emptied or hidden.
- A hidden category disappears from navigation; its products remain reachable by URL,
  search and other categories.

---

## 4. Finding products

### Sorting

Available orders: relevance (search results only), newest, price ascending, price
descending, name. Every listing has a stable default sort so pagination cannot skip or
repeat an item.

### Search

- One search field, matching product title, description, category name and merchant
  reference.
- Matching is language-aware for the shop content language, tolerant of case and
  accents, and tolerant of a missing plural.
- Results are ranked by relevance, with title matches ranked above description matches.
- No result is a designed state: it offers the closest categories and clears filters.

Typo tolerance and suggestions are *TBD*, and out of v1 unless free.

### Filters

- Filters are built from attributes marked filterable, plus price range and
  availability.
- Each filter value shows the **number of matching products** in the current context,
  and a value matching nothing is disabled rather than hidden — a disappearing option
  reads as a bug.
- Filters combine: values within one attribute widen the result (colour red *or* blue),
  different attributes narrow it (red *and* size M).
- Active filters are reflected in the URL so a filtered listing can be shared, bookmarked
  and reopened by the back button.
- Filtered URLs are excluded from search-engine indexing — see
  [storefront.md](storefront.md).

---

## 5. Images

- Images are uploaded in the back office and stored by the shop. External URLs are not
  a supported source.
- On upload, the shop derives the sizes it serves and keeps the original, which is never
  served. Any later change to the served sizes is applied by re-deriving from the
  original, without asking the merchant for the files again.

| Derived size | Used by |
|---|---|
| Thumbnail | Cart lines, order lines, search results, back office lists |
| Medium | Category grids, product cards |
| Large | Product page and zoom |

- Served formats favour the smallest modern encoding the browser accepts, with a
  fallback for browsers that accept none of them.
- Derivation happens once, at upload. Nothing is resized per request.
- Every image carries alternative text, prompted at upload; a product image without it
  is flagged in the back office.
- Limits: a maximum file size and a maximum number of images per product, both
  enforced with an explicit message (*TBD: values*). Without them, one merchant's photo
  library fills the disk and the shop stops.
- The first image is the product's default; staff order the rest explicitly.

---

## 6. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| Create, edit, publish, retire products and variants | Yes | Yes |
| Manage attributes and values | Yes | Yes |
| Manage categories | Yes | Yes |
| Upload and order images | Yes | Yes |
| Set prices and sale prices | Yes | Yes |
| Assign a tax rate to a product | Yes | Yes |
| Define the list of tax rates | No | Yes |

Bulk import and export are out of v1. A merchant with a large catalog is not the v1
target, and a half-designed importer is worse than none.
