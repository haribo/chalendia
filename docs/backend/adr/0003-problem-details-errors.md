# ADR 0003 — Problem Details for error responses

## Status

Active

## Context

Every failed request must be readable by two consumers that cannot negotiate:
the frontend, which maps the failure to a localized message and sometimes to a
form field, and a third-party client written against the published contract
(ADR 0002).

Without one declared shape, each route invents its own, the frontend accumulates
special cases, and the contract documents a promise the API does not keep.

## Decisions

Error responses follow **RFC 9457 (Problem Details for HTTP APIs)**, served with
the `application/problem+json` media type.

Fields used:

| Field | Meaning |
|---|---|
| `type` | Identifier of the problem kind. `about:blank` when the status code says everything |
| `title` | Short, stable, human-readable summary. Never localized |
| `status` | The HTTP status code, repeated in the body |
| `detail` | Explanation of this occurrence. Never localized, never a stack trace |

The shape applies to **every** failure the API produces, including the ones a
framework answers by default: an unmatched path, and a known path called with an
unsupported method, both go through it.

Localization is the client's responsibility: `title` and `detail` are diagnostic
text, not user-facing copy. The user-facing message is chosen by the frontend from
the problem kind, per `docs/design/core.md` § Errors.

Validation failures carry a per-field extension. Its exact shape is decided when
the first endpoint validates input, and this ADR is amended in place then — the
decision here is the envelope, not the extension.

## Rationale

- It is a standard, so a third-party client already knows the shape, and the
  contract can declare it once rather than per route.
- A dedicated media type lets a client distinguish an error body from a successful
  one without inspecting the payload.
- Repeating the status in the body survives proxies and logging pipelines that keep
  the payload but drop the status line.
- Keeping `title` and `detail` unlocalized keeps the API free of the interface's
  language, which is chosen by each user (`docs/design/core.md` § Languages) and is
  not necessarily known to the server.

## Alternatives considered

- **An ad-hoc envelope** (`{"error": {"code", "message"}}`) — rejected. Equivalent
  in substance, standard in nothing: every client has to be told about it, and the
  first exception to the convention is invisible.
- **Bare status codes with an empty body** — rejected. A 400 with no body forces the
  client to guess which of several causes applies.
- **Localized messages served by the API** — rejected. It would move interface copy
  into the backend, duplicate the i18n resources, and require the server to know the
  user's language on every route.

## Consequences

- Framework defaults that answer outside the shape must be overridden explicitly;
  the router does it for unmatched paths and unsupported methods, and any future
  layer that can reject a request (payload limits, rate limiting) must do the same.
- Adding a problem kind means adding a `type` value and declaring it in the
  contract, not inventing a new envelope.
- Tests assert the media type and the field set, so a regression to a bare body
  fails rather than merely looking different.
