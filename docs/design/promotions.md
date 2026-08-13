# Promotions — Design Specification

The two ways a price goes down: a sale price on a variant, and a discount code at
checkout.

**Status:** Work in progress.

---

## 1. Sale price

- A variant may carry a sale price with a start and an end date.
- While active, the storefront shows the sale price with the regular price struck
  through, everywhere the price appears: product page, listings, cart, order.
- A sale price above or equal to the regular price is refused at entry.
- Activation and expiry follow the shop timezone, without staff intervention.
- The order captures the price actually charged; a sale ending later changes nothing for
  orders already placed.

---

## 2. Discount codes

- A code has: the code itself, a discount as a percentage or a fixed amount, a validity
  window, a maximum number of uses in total, and a maximum number of uses per customer.
- The customer enters one code at checkout. **One code per order. Codes never stack.**
- The discount applies to the cart's line total **after** any sale prices, and before
  shipping. Whether a code can make shipping free is out of v1 — a code reduces goods,
  not delivery.
- A discount cannot exceed the line total; a fixed amount larger than the cart brings it
  to zero, never below.
- The discount is spread across lines in proportion to their share of the total, so that
  each tax rate keeps its correct base. A discount is never attributed to a single line
  by convenience.

### Validation, and when it happens

| Moment | Behavior |
|---|---|
| Entry at checkout | Accepted or refused immediately, with the reason: unknown, expired, not yet active, usage limit reached |
| Placement of the order | Re-validated. A code that became invalid in between stops the placement, and the customer is shown the new total before confirming again |

Usage is counted at placement, not at entry, and is released if the order is cancelled
or expires unpaid.

---

## 3. Display rules

- A cart carrying a code shows the discount as its own line, named after the code.
- The order and the invoice show the same line, with the code, so the merchant's
  accounting matches what the customer saw.
- Codes are case-insensitive and trimmed on entry; a customer retyping a code from an
  email should not fail on whitespace.

---

## 4. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| Set and remove sale prices | Yes | Yes |
| Create, edit, deactivate discount codes | Yes | Yes |
| See a code's usage count | Yes | Yes |
| Apply a code to an existing order | No | No |

A code is deactivated, never deleted, while orders reference it.

---

## 5. Out of v1

- Conditional rules: minimum cart, category-restricted, customer-restricted,
  buy-X-get-Y.
- Stacking, priority and combination rules between promotions.
- Free-shipping codes.
- Automatic discounts applied without a code.
- Single-use codes generated per customer.
