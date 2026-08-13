# Terminology

Vocabulary used across design documents, and the user-facing term where it differs.
Display layers use the user-facing term; design and code use the technical term.

## Surfaces

| Term | Definition |
|---|---|
| **Shop** | One Chalendia installation. One merchant, one catalog, one currency, one content language |
| **Storefront** | The public and customer-facing surface. User-facing name: shop |
| **Back office** | The staff surface. User-facing name: administration |
| **Setup** | The guided first-run configuration, available only until it completes |

## Catalog

| Term | Definition |
|---|---|
| **Product** | A sellable item as the customer perceives it: one page, one title, one description |
| **Variant** | A concrete buyable item of a product, defined by a combination of attribute values. Carries its own price, stock, weight and reference |
| **Attribute** | A named characteristic with a controlled set of values (size, colour, material). Used to define variants and to build filters |
| **Category** | A node of the merchant's classification tree, up to three levels deep |
| **Reference** | The merchant's own identifier for a variant. User-facing name: SKU |
| **Sale price** | A time-bounded reduced price shown against the struck-through regular price |
| **Retired** | State of a catalog record kept for existing orders but no longer sellable or listed |

## Purchase

| Term | Definition |
|---|---|
| **Cart** | The customer's current selection. Anonymous carts live in the browser; a signed-in cart lives on the shop |
| **Checkout** | The sequence from cart to placed order: address, shipping method, payment method, review |
| **Order** | A placed purchase. Immutable in its priced content once placed |
| **Reservation** | Stock held for an order awaiting payment, released when the payment deadline passes |
| **Fulfillment** | The staff-side work of preparing and handing an order to the carrier |
| **Shipment** | The parcel handed to a carrier for an order, carrying a tracking number |
| **Invoice** | The accounting document issued when an order is paid. Never modified after issue |
| **Discount code** | A code entered at checkout that reduces the order total under configured conditions |

## Roles

| Term | Definition |
|---|---|
| **Customer** | An account that browses and buys |
| **Operator** | Staff who run the shop day to day, without access to settings or credentials |
| **Administrator** | Staff with full access, including settings, credentials and staff management |
| **Merchant** | The person or business the shop belongs to. Not a role in the system |
| **Operator (hosting)** | Whoever installs and maintains the deployment. Disambiguated as *host operator* when both senses appear together |

## Content

| Term | Definition |
|---|---|
| **Page** | A merchant-written document with its own URL: legal pages, about, delivery terms |
| **Interface string** | Text shipped and translated by the project, never edited by the merchant |
| **Theme** | A named set of token values defining colours and styles. Never layout |
| **Token** | A named visual value referenced by the interface, resolved at runtime from the active theme and the merchant's settings |
