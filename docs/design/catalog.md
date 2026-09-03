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
- On upload the shop derives the sizes it serves and keeps the **source**, which is
  never served. Any later change to the served sizes is applied by re-deriving from it,
  without asking the merchant for the files again.

| Derived size | Long side | Used by |
|---|---|---|
| Thumbnail | 200 px | Cart lines, order lines, search results, back office lists |
| Medium | 600 px | Category grids, product cards |
| Large | 1400 px | Product page and zoom |

Ratios are kept; the numbers are the long side, so a portrait and a landscape photograph
of the same product sit in the same grid.

### What the shop keeps, and what it never sees

The browser **reduces a photograph to 2400 px on the long side before uploading it**, and
that reduced file is what the shop keeps as its source. A phone photograph is several
megabytes for something served at 1400 px, and the upload is the slowest part of a
merchant's day.

The consequence is stated rather than implied: **the untouched original never reaches the
shop**. Re-derivation stays possible for every size a web page displays — that is what
the promise above is worth — and a 4K nobody shows is given up. A source below 800 px on
the long side is refused, since the large size would be an upscale; **a source above
2400 px is refused too**, rather than quietly reduced. The browser's reduction is a
convenience for the merchant, and the limit is the shop's own — a client that skips the
browser is told what the shop keeps instead of being told nothing and served something
else.

### One format, and what that costs

The browser converts to **JPEG** and the shop accepts nothing else: one decoding branch,
and a smaller surface for a file arriving from outside.

**Transparency is flattened onto white** during that conversion. A cut-out product on a
transparent background — what a photography studio delivers by default — becomes a white
rectangle, invisible on a light page and plainly visible on a dark one. This is a
deliberate trade for simplicity, recorded here so a merchant's complaint about a white
background meets a decision that can be revisited rather than a surprise.

### Serving

- Served in **AVIF**, with a fallback for browsers that accept none of the modern
  formats. Encoding is slower and happens once per image; the bytes saved are paid on
  every visit.
- Derivation happens once per image and **after the upload answers**: a merchant adding
  ten photographs does not wait for twenty seconds of encoding. Until it is done the shop
  serves the source, and the back office shows which images are still being prepared —
  never a silent gap ([backend ADR 0008](../backend/adr/0008-image-pipeline.md)).
- Nothing is ever resized per request.
- Every image carries alternative text, prompted at upload; a product image without it
  is flagged in the back office.
- Limits: **8 MB per file and 10 images per product**, refused with an explicit message.
  Without them, one merchant's photo library fills the disk and the shop stops. They are
  enforced by the shop, never only by the browser: a client sends whatever it wants.
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

---

## 7. In the back office

What staff see when they manage the catalogue, as opposed to what a customer sees.

### The list

- Columns: title, merchant reference when there is one, price, publication state. The
  thumbnail joins them once products carry images.
- Default order: **most recently created first**, with the identifier breaking ties. A
  merchant who has just created a product finds it at the top, and the order of a page
  does not change under an edit made while paging through it.
- The empty state is not an empty table. A shop that was just installed has no products,
  and that screen says what to do next rather than showing column headers over nothing.

### Creating a product

- Required: **title** and **price**. Nothing else stops a merchant from saving.
- Optional: description, merchant reference.
- A product is created as a **draft** unless staff publish it from the same form. Draft
  is the safe default: a half-described product must not appear in the shop because
  someone was interrupted.
- Price is entered **inclusive of tax**, in the currency's major units, and held in
  minor ones ([core.md](core.md) § 5, § 6).
- The public address of a product derives from its title and is unique. Renaming a
  product does not change an address already given out; that, and the redirect an old
  address keeps serving, belong with the storefront
  ([storefront.md](storefront.md)).

### Before the shop has tax rates

A shop is installed with VAT on or off, and with no list of rates in either case. Until
that list exists, no back-office screen shows a tax amount: the price shown is the price
entered. Assigning a rate to a product, and the shop default that applies without one,
stay as [core.md](core.md) § 6 states them.
