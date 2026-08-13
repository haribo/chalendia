# Cart and checkout — Design Specification

From adding a variant to placing an order.

**Status:** Work in progress.

---

## 1. Cart

- A cart holds variants with quantities. Adding a product without choosing its
  variant-defining attributes is impossible.
- **Anonymous visitors** have a cart stored in their browser. It survives a reload and a
  closed tab; it does not follow them to another device.
- **Signed-in customers** have a cart stored on the shop. It follows them everywhere and
  survives sign-out.
- A cart holds no stock. Availability is checked when it is displayed and again when the
  order is placed.
- Quantity is capped by current availability, with an explicit message when the cap
  applies.

### Merge on sign-in

When an anonymous cart meets an account cart, the result is one cart:

| Situation | Result |
|---|---|
| A variant in only one of the two | Kept |
| A variant in both | Quantities added, then capped at availability |
| Merged quantity above availability | Capped, with a message naming the variant |
| Variant no longer buyable (retired, unpublished, out of stock) | Removed, with a message naming it |
| Price changed since the item was added | Current price applies, silently — the cart never shows a price the shop will not honour |

The merge is never silent when it changed something the customer chose.

---

## 2. Prerequisites to order

- A verified customer account. An unverified account reaching checkout is sent to
  verification and returns to its cart afterwards.
- A shipping address, a shipping method, and a payment method.
- At least one line, all lines available.

---

## 3. Checkout sequence

| Step | Content |
|---|---|
| 1. Delivery | Choose or enter a shipping address; choose a shipping method among those available for that address |
| 2. Payment | Choose a payment method among those the merchant enabled |
| 3. Review | Full breakdown: lines, discounts, shipping, tax, total; legal acceptance; place the order |

- Each step is a distinct URL: the back button works, a reload does not lose the cart,
  and an interrupted checkout can be resumed.
- Available shipping methods depend on the destination country and on what the cart
  contains. A destination no method serves is refused at step 1, not at payment.
- The customer accepts the terms of sale explicitly before placing the order, with a
  link to them.
- The order total is recomputed on the server when the order is placed. A client-side
  total is never trusted.

---

## 4. Placing the order

Placing an order, in one transaction:

1. Re-checks availability of every line.
2. Re-applies pricing, promotions and shipping cost.
3. Reserves stock ([inventory.md](inventory.md)).
4. Creates the order in a payment-pending state ([orders.md](orders.md)).
5. Empties the cart.

If any line became unavailable, nothing is created: the customer returns to the cart
with the offending lines marked. A partially placed order is never created.

If the total changed between review and placement — a promotion expired, a shipping rate
moved — the customer is shown the new total and confirms again before anything is
reserved.

---

## 5. After placement

- The customer lands on a confirmation page carrying the order reference and, for bank
  transfer, the payment instructions.
- The same information is emailed ([notifications.md](notifications.md)). The page is
  never the only place the instructions exist.
- An unpaid order remains resumable from the customer's account until its deadline.

---

## 6. Out of v1

- Guest checkout.
- Saved payment methods.
- Abandoned-cart recovery, in any form.
- Gift options, order notes, delivery date choice.
- Partial checkout of a cart.
