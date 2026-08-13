# Payments — Design Specification

How an order gets paid, and what the customer and staff see at each step.

**Status:** Work in progress.

---

## 1. Principles

- Payment methods are a **configurable list**. A shop enables the ones it wants.
- All amounts are in the shop currency.
- Chalendia never receives, stores or transmits card data. Card payment happens on the
  provider's own hosted page.
- A payment method is never the reason an order exists in an inconsistent state:
  reservation, confirmation and cancellation are designed together with
  [inventory.md](inventory.md) and [orders.md](orders.md).

---

## 2. Methods in v1

| Method | Customer experience | Confirmation |
|---|---|---|
| **Bank transfer** | Order is placed immediately, with instructions and a deadline | Staff mark it paid when funds arrive |
| **Card, hosted checkout** | Redirected to the provider, pays, returns to the shop | The provider notifies the shop; the notification, not the return, is what confirms |

A shop with no method enabled cannot take orders, and the back office says so plainly
rather than letting the storefront fail at checkout.

---

## 3. Bank transfer

- The merchant configures the instructions once: account details, the reference the
  customer must quote, and the number of days before the order expires.
- The order is created as awaiting payment, stock reserved, deadline visible on the
  confirmation page, in the customer's account, and in the email.
- Staff see awaiting-payment orders as a working list and mark each paid or cancelled.
- On the deadline, an unpaid order is cancelled automatically, its reservation released,
  and both customer and staff are notified.

Marking an order paid is an accounting act: it is restricted, it is audited, and it
triggers the invoice.

---

## 4. Card payment

- The customer is redirected to the provider's hosted payment page for the exact order
  total.
- The order exists before the redirection, awaiting payment, with stock reserved for the
  duration of the payment session.
- **Confirmation comes from the provider's server-to-server notification.** The
  customer's return to the shop is a user-interface event and never, by itself, marks an
  order paid.
- If the customer abandons or fails, the order stays awaiting payment and is resumable
  from their account until the session expires; a resumed attempt reuses the same order.
- If the notification arrives after the reservation expired, the payment is honoured and
  the shortage is surfaced to staff as an exception to handle (*TBD: exact staff-facing
  behavior; it must not be a silent oversell*).
- Duplicate notifications for one order are idempotent: an order is paid once.

---

## 5. Failure and reconciliation

| Situation | Behavior |
|---|---|
| Provider unreachable at checkout | Card method is presented as temporarily unavailable; other methods still work |
| Notification never arrives | Order expires like any unpaid order; staff can see the provider reference to check manually |
| Amount received differs from the order total | Never confirmed automatically; raised to staff |
| Payment confirmed for a cancelled order | Raised to staff as an exception; the money is not silently kept against nothing |

Refunds are out of v1: the merchant refunds from their provider's own interface, and
Chalendia records nothing about it. This is a deliberate limitation, stated to the
merchant in the back office rather than discovered.

---

## 6. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| See payment status and provider reference | Yes | Yes |
| Mark a bank-transfer order paid or cancelled | Yes | Yes |
| Configure methods, credentials, instructions, deadlines | No | Yes |

Credentials are write-only: once saved, they are never displayed back, only replaced.

---

## 7. Out of v1

- Refunds and partial refunds from the shop.
- Saved cards and one-click reordering.
- Multiple providers enabled simultaneously for the same card flow.
- Payment on delivery, cash, cheque (addable as offline variants; not designed here).
- Instalments, deposits, subscriptions.
