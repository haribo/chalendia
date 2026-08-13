# Notifications — Design Specification

Every message the shop sends, to whom, and when.

**Status:** Work in progress.

---

## 1. Principles

- **Email is the only channel.** No in-app notification centre, no SMS, no push.
- **Transactional only.** Chalendia sends nothing a customer did not trigger by acting on
  the shop. There is no marketing email and no opt-in list to manage.
- Messages are sent in the **recipient's interface language**, with merchant content
  (product titles, page text) embedded as written in the shop content language.
- Every message identifies the shop by name, and links back to the relevant page.

---

## 2. Messages to customers

| Trigger | Contains |
|---|---|
| Registration | Verification link |
| Registration on an existing address | Notice that an account already exists, with a reset link |
| Password reset requested | Single-use expiring link |
| Password changed | Confirmation, with what to do if it was not them |
| Order placed, bank transfer | Order summary, payment instructions, reference, deadline |
| Order placed, card paid | Order summary and confirmation |
| Payment received | Confirmation and invoice |
| Order shipped | Tracking number and link |
| Unpaid order about to expire | Deadline reminder (*TBD: how long before, and whether it exists in v1*) |
| Order cancelled | Reason, and what happens next |
| Account deletion | Confirmation that it is done and what was retained |

---

## 3. Messages to staff

| Trigger | Recipient |
|---|---|
| New order placed | Shop notification address |
| Bank-transfer order expired, stock released | Shop notification address |
| Payment confirmed after its reservation expired | Shop notification address |
| Carrier request failed | Shop notification address |

Staff alerts go to one merchant-configured address, not to each staff account. Per-user
notification preferences are out of v1.

---

## 4. Sending

- The merchant configures an SMTP server, a sender address and a sender name. This is the
  only sending mode shipped in v1; the design treats it as one implementation of a single
  sending interface so another can be added without touching any message.
- The back office can send a test message and reports the exact failure when it fails.
- A message that cannot be sent is retried a bounded number of times, then recorded as
  failed and surfaced to staff. **A failed email never rolls back the action that
  triggered it**: an order exists whether or not its confirmation was delivered.
- Sent and failed messages are listed in the back office with their trigger, recipient
  and time (*TBD: retention*).

Deliverability depends on the merchant's DNS configuration (SPF, DKIM, DMARC). The
operator documentation must explain it, because a shop whose confirmations land in spam
looks broken and is not.

---

## 5. Content and appearance

- Messages are plain and readable, with a text alternative to the formatted version.
- Templates ship with the product, translated by the project, and are not merchant-editable
  in v1 — beyond the shop name, logo and sender identity.
- No tracking pixel, no open or click tracking, ever.

---

## 6. Out of v1

- Merchant-editable templates.
- Third-party sending services.
- Per-staff-user notification routing.
- Any marketing message, including abandoned carts, restock alerts and review requests.
