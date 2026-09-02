# ADR 0007 — Passwords are refused on strength, not on composition

**Status:** Accepted — 2026-09-02

Extends [ADR 0005](0005-passwords-and-sessions.md), which decided how passwords are
stored. This decides which ones are accepted at all.

## Context

The only rule was a minimum of twelve characters, stated to the user before they
submit. It is what current guidance recommends over composition rules — but on its own
it accepts `motdepasse123` and `aaaaaaaaaaaa`, and the interface drew a full strength
bar for the second one, because the bar measured length and called it strength.

The design already required "rejection of known-breached passwords", with an explicit
*TBD* on the source and on whether it could work for an offline installation. A shop
that is self-hosted may have no outbound internet at all, so a live breach API is not
something every install can rely on.

## Decision

**Refuse a password `zxcvbn` estimates as guessable**, at a minimum score of 3 out of 4,
in addition to the twelve-character minimum.

The shop's own words are passed as context — the shop name, the legal identity, the
staff address — so a password built from them is penalised the way a name is.

### Why not the hand-written scorer used by tribnest

It reimplements what zxcvbn does: sequences, keyboard patterns, leet substitutions,
dates, repetitions, a common-password list. Around 350 lines and a 10,000-line word
list, to obtain something with less testing behind it than the reference
implementation. zxcvbn also returns an estimated **guessing time** rather than an
arbitrary score, which is what makes a person change their password.

### Why not a breach API

`HaveIBeenPwned` and its equivalents need outbound internet, and a self-hosted shop may
have none. zxcvbn carries its dictionaries in the binary — including leaked passwords —
so the check works the same offline. This closes the *TBD* in
`docs/design/core.md` § 3.

### Why the scorer does not run in the browser

zxcvbn in JavaScript weighs hundreds of kilobytes, on a shop whose argument is being
light on resources. The bar shown while typing is a deliberately conservative local
estimate; the refusal comes from the server, which is the only side that decides
anything.

## Consequences

- The binary carries dictionaries, and grows. Measured in the pull request that
  introduced this.
- A refusal has to say **why**, in the reader's language: zxcvbn's warning and
  suggestions travel as identifiers the interface translates, never as English prose
  from the server (`docs/design/core.md` § 8, Errors).
- Score 3 rather than 4: four is very hard to reach without a generator, and a rule
  people work around by writing passwords down protects nothing.
