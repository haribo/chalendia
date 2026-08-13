# Orders and invoices — Design Specification

The order lifecycle, what each state means to the customer and to staff, and the
accounting documents an order produces.

**Status:** Work in progress.

---

## 1. What an order is

An order is the record of a purchase, priced at the moment it was placed.

- It carries a **reference**, unique per shop, shown to the customer and used in every
  communication. It is not the internal identifier and it is not guessable in sequence
  (*TBD: exact format*).
- It captures, at placement: the customer's identity and addresses, each line's product
  title, reference, unit price, quantity and tax rate, the discounts applied, the
  shipping method and cost, and every total.
- **Captured values never change afterwards.** A later price change, product rename,
  address edit or account deletion leaves the order exactly as it was.

---

## 2. States

| State | Meaning | Customer sees | Reached from |
|---|---|---|---|
| Awaiting payment | Placed, stock reserved, not paid | Instructions and deadline | Placement |
| Paid | Payment confirmed, invoice issued | Confirmation | Awaiting payment |
| Preparing | Staff are preparing the parcel | Progress | Paid |
| Shipped | Handed to the carrier, tracking available | Tracking | Preparing |
| Delivered | Carrier reported delivery | Delivered | Shipped |
| Cancelled | Terminal. Reservation released | Reason | Awaiting payment |

Rules:

- Cancellation is possible only while awaiting payment. A paid order is not cancellable
  in v1, because refunding is outside the application.
- The transition to paid is what issues the invoice, exactly once.
- Delivered is informational; it is only reachable when the carrier reports it.
- Every transition records who or what caused it, and when.

---

## 3. Invoices

- An invoice is issued when the order becomes paid, never before, never twice.
- It carries a **gapless sequential number** per shop, allocated at issue and never
  reused, including when a later issue fails.
- It contains the merchant's legal identity, the customer's billing identity as captured
  on the order, the lines with their tax rates, the tax breakdown per rate, the totals,
  and the payment method used.
- **An issued invoice is never modified.** Not by a customer address change, not by a
  product rename, not by account deletion, not by staff.
- It is available as a PDF to the customer in their account and to staff on the order,
  and it is attached to or linked from the payment confirmation email (*TBD: attachment
  versus link*).
- Numbering is continuous across the shop's lifetime; nothing in the back office can
  reset it.

Credit notes do not exist in v1 — no refund path does. The numbering and immutability
rules above are written so that adding them later is an addition, not a contradiction.

---

## 4. Customer view

- Order history, most recent first, with state, date, total and reference.
- An order detail shows the lines, the totals breakdown, the addresses, the payment
  method, the tracking when shipped, and the invoice when paid.
- An unpaid order can be resumed or abandoned from here.
- Orders remain visible for the account's lifetime, and remain in the merchant's records
  after account deletion in anonymized form — see [account.md](account.md).

---

## 5. Staff view

- A working list filtered by state, searchable by reference, customer name, email and
  product reference.
- The states that need action — awaiting payment past deadline, paid and not yet
  prepared, prepared and not yet shipped — are directly reachable, because they are the
  merchant's daily routine.
- An order shows its full transition history, its payment reference, and its carrier
  exchanges when any.

| Action | Operator | Administrator |
|---|---|---|
| See orders, invoices and history | Yes | Yes |
| Mark paid, prepare, label, ship | Yes | Yes |
| Cancel an unpaid order | Yes | Yes |
| Edit an order's content or totals | No | No |
| Change invoice numbering or reissue an invoice | No | No |

Nobody edits a placed order. A mistake is handled outside the application in v1, which
is a limitation the back office states rather than hides.

---

## 6. Out of v1

- Returns, refunds, credit notes.
- Editing or splitting a placed order.
- Partial shipment and partial payment.
- Exporting orders or invoices in bulk, and accounting-software integration.
