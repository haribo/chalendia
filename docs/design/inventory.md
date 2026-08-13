# Inventory — Design Specification

Stock per variant, and how it is held while an order waits to be paid.

**Status:** Work in progress.

---

## 1. Tracking

- Stock is held **per variant**, as a whole number of units.
- Tracking is enabled per product. A product with tracking off is always buyable and
  never shows a quantity — the case of made-to-order goods.
- Staff set stock directly, as an absolute value or as an adjustment, and every change
  records who made it and why (*TBD: reason list*).

---

## 2. Availability

| Available quantity | Storefront |
|---|---|
| Greater than the low threshold | Buyable, no quantity shown |
| One to the low threshold | Buyable, shown as limited availability |
| Zero | Shown, not buyable, with the reason |

- **Available** means on-hand minus reserved. The customer never sees on-hand.
- A variant at zero stays visible on the product page as an unselectable choice; hiding
  it makes the customer think the product changed.
- The low threshold is a shop setting (*TBD: default value*).
- Overselling is refused: an order that would take availability below zero cannot be
  placed. Backorders and negative stock are out of v1.

---

## 3. Reservation

Stock is reserved when the order is placed, not when it enters a cart. A cart holds
nothing.

| Payment method | Reservation lasts |
|---|---|
| Card (Stripe Checkout) | The payment session, plus a short grace period for the confirmation to arrive |
| Bank transfer | A merchant-configured number of days, shown to the customer at checkout and in the email |

- While reserved, the quantity is unavailable to everyone else.
- On payment confirmation, the reservation becomes a stock decrement.
- On expiry, the reservation is released and the order is cancelled, with a notification
  to the customer and to staff. Staff can cancel earlier.
- Staff may extend a pending bank-transfer order's deadline once the customer says the
  transfer is on its way (*TBD: whether extension is a distinct action or a deadline
  edit*).

The reservation is the reason two customers cannot both pay for the last unit. Without
it, the shop takes money it cannot honour, and refunds are out of v1.

---

## 4. Restock and history

- Restocking is a manual stock adjustment. Purchase orders and supplier management are
  out of v1.
- A cancelled or expired order returns its reserved units to availability. A shipped
  order never does.
- Stock movements are readable per variant, most recent first: what changed, by how
  much, when, why, and by whom.

---

## 5. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| View stock and movements | Yes | Yes |
| Adjust stock | Yes | Yes |
| Enable or disable tracking on a product | Yes | Yes |
| Cancel a pending order and release its reservation | Yes | Yes |
| Set the low-stock threshold and the transfer deadline | No | Yes |

Low-stock alerting by email is out of v1; the back office surfaces low stock in its
listings.
