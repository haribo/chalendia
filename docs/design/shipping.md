# Shipping — Design Specification

How a cart becomes a parcel: methods offered, rates charged, labels produced, tracking
shown.

**Status:** Work in progress.

---

## 1. Principles

- Shipping methods are a **configurable list**, like payment methods. A shop enables
  what it can actually ship with.
- **A manual flat-rate method is always available**, whatever integrations exist. It is
  the method a merchant without a carrier contract uses, and the one automated tests
  exercise.
- One carrier integration ships in v1. The list is designed so a second carrier is a new
  entry, not a redesign.
- A rate shown at checkout is the rate charged. A rate that cannot be determined is
  never guessed.

---

## 2. Methods

| Method | Rate | Requires |
|---|---|---|
| **Flat rate** | Fixed per destination zone, with an optional free-shipping threshold | Zones defined by the merchant |
| **Carrier** | Computed for the parcel and destination | A merchant account with the carrier, and weights on the products |

- A **zone** is a named set of countries with a rate. A destination in no zone is not
  serviceable, and the customer is told at the address step.
- The carrier shipped in v1 is Colissimo. Whether its rates come from a live query or
  from a merchant-imported rate table is *TBD* and does not change what the customer
  sees: one price, before payment.

---

## 3. Rates at checkout

- Available methods are computed from the destination, the cart weight and the cart
  total, and presented with their price and expected delay (*TBD: source of the delay
  estimate*).
- When a carrier rate cannot be obtained — network failure, refused address, missing
  weight — the carrier method is not offered, and any flat-rate method still is. Checkout
  never blocks on a third party.
- Free shipping from a threshold applies to the cart total after discounts.
- Shipping is taxed per [core.md](core.md).

---

## 4. Fulfillment

Staff work an order from the back office:

| Step | Result |
|---|---|
| Mark as being prepared | Order moves to preparation; the customer sees it |
| Generate the label (carrier methods) | The shop requests the shipment, gets a label to print and a tracking number |
| Mark as shipped | The customer is emailed with the tracking number and link |

- Label generation is only possible once the order is paid.
- A failed label request leaves the order untouched and shows the carrier's reason; it
  never marks a shipment that does not exist.
- For the flat-rate method there is no label: staff mark the order shipped and may enter
  a tracking number by hand, which is then shown to the customer.
- One shipment per order in v1. Partial shipments are out of scope.

---

## 5. Tracking

- The tracking number and its carrier link appear in the shipping email, on the order in
  the customer's account, and in the back office.
- Delivery status is refreshed from the carrier where the integration supports it, and
  shown as the carrier reports it (*TBD: refresh cadence, and whether delivery
  confirmation changes the order state*).
- The shop never claims a delivery status it did not receive.

---

## 6. Products and parcels

- A variant carries a weight. Without it, no carrier rate can be computed and the
  carrier method is unavailable for any cart containing it — the back office flags such
  variants rather than letting checkout fail.
- Dimensions are captured when the carrier requires them (*TBD: confirm with the carrier
  contract*).
- Parcel packing is not modelled: an order is one parcel whose weight is the sum of its
  lines, plus a merchant-configured packaging allowance.

---

## 7. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| Prepare, label, ship, enter tracking | Yes | Yes |
| See carrier errors | Yes | Yes |
| Define zones, flat rates, thresholds, packaging allowance | No | Yes |
| Configure carrier credentials | No | Yes |

---

## 8. Out of v1

- Parcel-shop and pickup-point delivery, and the map selector it requires.
- Carrier aggregators.
- Weight or price grids beyond the flat rate per zone.
- Multiple parcels or partial shipments per order.
- Return labels — after-sales is outside the application in v1.
- Pickup at the shop.
