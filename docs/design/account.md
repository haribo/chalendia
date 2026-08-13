# Customer account — Design Specification

Registration, sign-in, the customer's own area, and their rights over their data.

**Status:** Work in progress.

---

## 1. Registration

- Email and password, chosen by the visitor. No other field is required to create the
  account.
- A verification message is sent to the address. Until it is used, the account can
  browse and hold a cart, but cannot place an order.
- Registering with an address that already exists produces the same visible outcome as a
  new registration, and sends a message to that address explaining that an account
  already exists. The visitor is never told whether an address is registered.
- Verification links expire and can be re-requested, with rate limiting.

---

## 2. Sign-in and passwords

- Sign-in with email and password. Failures do not distinguish a wrong password from an
  unknown address.
- Password reset by email, with an expiring single-use link. Using it signs out other
  sessions.
- Changing the password requires the current one and signs out other sessions.
- Repeated failures are rate-limited per account and per origin, with the delay stated
  to the user (*TBD: thresholds*).

---

## 3. Identity and addresses

| Data | Required | Used for |
|---|---|---|
| Email | Yes | Sign-in, every notification |
| First and last name | At first order | Invoices, shipping labels |
| Phone | When the carrier requires it | Delivery |
| Addresses | At first order | Shipping and billing |

- A customer keeps an address book, with a default shipping address and a default
  billing address.
- Editing or deleting an address never alters the addresses captured on past orders.
- Names and addresses are normalized on save, consistently with
  [core.md](core.md).

---

## 4. The customer's area

- Orders, most recent first, with the detail described in [orders.md](orders.md),
  including invoices and tracking.
- Unpaid orders can be resumed or abandoned.
- Address book, profile, password, interface language.
- Data export and account deletion.

---

## 5. Data rights

### Export

The customer can download their personal data — identity, addresses, orders and their
content — in a machine-readable format, from their account, without asking anyone.

### Deletion

Deletion is a two-condition process:

1. **Refused while work is open.** An order that is awaiting payment, being prepared, or
   shipped but not delivered blocks deletion. The customer is shown exactly what must
   conclude first.
2. **Then erased and anonymized.** Identity, credentials, addresses and profile are
   removed; the person can no longer sign in. Orders and invoices remain in the
   merchant's records, with the customer's identity on them replaced by an anonymous
   marker.

Issued invoices are not touched: they keep the billing identity captured at issue,
because they are accounting evidence the merchant is required to retain. This is stated
to the customer before they confirm.

Deletion is irreversible and the confirmation says so.

### Consent

Chalendia sets no tracking cookie and embeds no third-party analytics, so it ships no
consent banner. An operator adding a tracker becomes responsible for the consent
mechanism it requires — stated in the operator documentation, not assumed.

---

## 6. Staff capabilities

| Action | Operator | Administrator |
|---|---|---|
| Look up a customer, see their orders | Yes | Yes |
| Edit a customer's identity or addresses | No | No |
| Reset a customer's password | No | No |
| Delete a customer account on request | No | Yes |
| Grant or revoke staff roles | No | Yes |

Staff never act as a customer and never see a password. A merchant handling a deletion
request by mail uses the same deletion behavior, with the same blocking conditions.

---

## 7. Out of v1

- OAuth sign-in, two-factor authentication.
- Wishlists, saved carts, product reviews.
- Marketing preferences and newsletters — no marketing email exists.
- Customer groups, loyalty, store credit.
