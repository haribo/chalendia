//! Password hashing and verification. See `docs/backend/adr/0005-passwords-and-sessions.md`.

use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use argon2::{Algorithm, Argon2, Params, Version};

/// The floor, below which nothing else is worth computing
/// (`docs/design/core.md` § 3). Length alone is not the rule: it accepts
/// `motdepasse123`, which a dictionary finds instantly.
pub const MINIMUM_LENGTH: usize = 12;

/// Out of four. Three is "safely unguessable"; four is very hard to reach
/// without a generator, and a rule people work around by writing passwords
/// down protects nothing (backend ADR 0007).
pub const MINIMUM_SCORE: u8 = 3;

/// OWASP's current recommendation for Argon2id: 19 MiB, two passes, one lane.
/// Raising these is a code change — an operator lowering a security parameter
/// through configuration is a footgun, not a feature.
const MEMORY_KIB: u32 = 19 * 1024;
const ITERATIONS: u32 = 2;
const PARALLELISM: u32 = 1;

#[derive(Debug, PartialEq, Eq)]
pub enum PasswordError {
    TooShort {
        minimum: usize,
    },
    /// Long enough, and a dictionary still finds it. The identifier is what
    /// the interface translates — a server writing prose writes it in a
    /// language it cannot know (`docs/design/core.md` § 8, Errors).
    Guessable {
        reason: Weakness,
    },
}

/// What zxcvbn found, reduced to what the shop is willing to say about it.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Weakness {
    /// In a list of passwords people actually use.
    Common,
    /// `aaaa`, `abcabc`: a pattern rather than a choice.
    Repeated,
    /// `azerty`, `123456`: a walk on the keyboard or through the alphabet.
    Sequence,
    /// A date, a year — a small set dressed up as a number.
    Date,
    /// Guessable without one of the shapes above having a name.
    Guessable,
}

impl Weakness {
    /// The identifier the interface looks up. Stable, never a sentence.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Common => "common",
            Self::Repeated => "repeated",
            Self::Sequence => "sequence",
            Self::Date => "date",
            Self::Guessable => "guessable",
        }
    }
}

/// Names the shape zxcvbn matched, so the interface can say something more
/// useful than "too weak" without the server choosing the words.
fn weakness_of(estimate: &zxcvbn::Entropy) -> Weakness {
    use zxcvbn::matching::patterns::MatchPattern;

    let strongest = estimate
        .sequence()
        .iter()
        .max_by_key(|part| part.token.chars().count());

    match strongest.map(|part| &part.pattern) {
        Some(MatchPattern::Dictionary(_)) => Weakness::Common,
        Some(MatchPattern::Repeat(_)) => Weakness::Repeated,
        Some(MatchPattern::Sequence(_) | MatchPattern::Spatial(_)) => Weakness::Sequence,
        Some(MatchPattern::Date(_)) => Weakness::Date,
        _ => Weakness::Guessable,
    }
}

fn argon2() -> Argon2<'static> {
    let params = Params::new(MEMORY_KIB, ITERATIONS, PARALLELISM, None)
        .expect("the compiled-in Argon2 parameters are valid");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Rejects what the design refuses, before anything is stored.
///
/// `context` is what this shop already knows about the person and the shop —
/// the address, the shop name — so a password built out of them is penalised
/// the way any other known word is.
pub fn check(password: &str, context: &[&str]) -> Result<(), PasswordError> {
    // Counted in characters, not bytes: a passphrase in any script gets the
    // same rule, and a byte count would quietly demand fewer of them.
    if password.chars().count() < MINIMUM_LENGTH {
        return Err(PasswordError::TooShort {
            minimum: MINIMUM_LENGTH,
        });
    }

    let estimate = zxcvbn::zxcvbn(password, context);
    if u8::from(estimate.score()) >= MINIMUM_SCORE {
        return Ok(());
    }

    Err(PasswordError::Guessable {
        reason: weakness_of(&estimate),
    })
}

/// Returns the PHC string to store. Never returns the password, and the
/// password never reaches a log or an error on the way.
pub fn hash(password: &str) -> String {
    // The salt is the crate's own, drawn from the operating system: since
    // password-hash 0.6 the helper uses `getrandom` directly rather than a
    // `rand_core` generator, which is what this code used to draw by hand to
    // avoid bridging two versions of a randomness trait.
    argon2()
        .hash_password(password.as_bytes())
        .expect("hashing a password with valid parameters cannot fail")
        .to_string()
}

/// Verification against a stored PHC string.
///
/// A malformed or unreadable stored hash verifies as false rather than as an
/// error: from the caller's side there is nothing else to do, and the two
/// outcomes must be indistinguishable to whoever is trying passwords.
pub fn verify(password: &str, stored: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(stored) else {
        return false;
    };

    argon2()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A passphrase nothing in this shop hints at.
    const GOOD: &str = "correct horse battery staple";

    #[test]
    fn a_password_shorter_than_the_minimum_is_refused() {
        let error = check("shorty", &[]).unwrap_err();

        assert_eq!(
            error,
            PasswordError::TooShort {
                minimum: MINIMUM_LENGTH
            }
        );
    }

    #[test]
    fn length_is_counted_in_characters_not_bytes() {
        // Ten characters, thirteen bytes: counted in bytes this would clear the
        // twelve-character floor, and it must not. The rule is about the
        // password, not about its encoding.
        assert_eq!(
            check("café brûlé", &[]),
            Err(PasswordError::TooShort {
                minimum: MINIMUM_LENGTH
            })
        );
    }

    /// Twelve characters and a dictionary finds it: length is a floor, never
    /// the rule (#71).
    #[test]
    fn a_long_password_a_dictionary_knows_is_refused() {
        assert_eq!(
            check("motdepasse123", &[]),
            Err(PasswordError::Guessable {
                reason: Weakness::Common
            })
        );
    }

    #[test]
    fn a_repeated_character_is_named_as_such() {
        assert_eq!(
            check("aaaaaaaaaaaa", &[]),
            Err(PasswordError::Guessable {
                reason: Weakness::Repeated
            })
        );
    }

    #[test]
    fn a_walk_on_the_keyboard_is_refused() {
        assert!(matches!(
            check("azertyuiop12", &[]),
            Err(PasswordError::Guessable { .. })
        ));
    }

    /// The whole argument against composition rules: this one has a capital,
    /// a digit and a symbol, and is guessed in seconds.
    #[test]
    fn composition_proves_nothing() {
        assert!(matches!(
            check("Password123!", &[]),
            Err(PasswordError::Guessable { .. })
        ));
    }

    /// What the shop already publishes is not a secret: an operator using
    /// their own address is using something an attacker reads on the contact
    /// page.
    ///
    /// Measured: this catches the address itself, not everything built out of
    /// it — `fabriquesavons2026` scores the same either way, and backend
    /// ADR 0007 says so rather than promising more.
    #[test]
    fn a_password_the_shop_already_publishes_is_refused() {
        let known = ["owner@fabrique-savons.fr", "La Fabrique à Savons"];

        assert!(matches!(
            check("owner@fabrique-savons.fr", &known),
            Err(PasswordError::Guessable { .. })
        ));
        // The same string, on a shop it has nothing to do with.
        assert!(check("owner@fabrique-savons.fr", &[]).is_ok());
    }

    /// A merchant keeps the right to choose something they will remember.
    #[test]
    fn a_memorable_password_is_still_accepted() {
        assert!(check("savon2marseille", &[]).is_ok());
    }

    #[test]
    fn a_long_passphrase_needs_nothing_else() {
        assert!(check(GOOD, &[]).is_ok());
    }

    #[test]
    fn a_password_verifies_against_its_own_hash() {
        let stored = hash(GOOD);

        assert!(verify(GOOD, &stored));
    }

    #[test]
    fn another_password_does_not() {
        let stored = hash(GOOD);

        assert!(!verify("Correct horse battery staple", &stored));
    }

    #[test]
    fn the_same_password_hashes_differently_every_time() {
        // Per-password salt: two accounts sharing a password must not share a
        // digest, or one cracked hash reveals both.
        assert_ne!(hash(GOOD), hash(GOOD));
    }

    #[test]
    fn the_stored_hash_reveals_neither_the_password_nor_a_bare_digest() {
        let stored = hash(GOOD);

        assert!(!stored.contains("correct horse"));
        assert!(stored.starts_with("$argon2id$"));
    }

    /// Written by argon2 0.5.3, before the crate changed its API (#64). Every
    /// installation that has run setup holds hashes like this one, and a
    /// migration that cannot read them locks operators out of their own shop.
    const WRITTEN_BY_0_5_3: &str = "$argon2id$v=19$m=19456,t=2,p=1$QU3Dj1s+IqTTK8HcDMSEAg$kYic6d3F7anIr7esNW+Lx14hUjs2hUbW69NYCwj24ys";

    #[test]
    fn a_hash_written_by_the_previous_version_still_verifies() {
        assert!(verify(GOOD, WRITTEN_BY_0_5_3));
        assert!(!verify("Correct horse battery staple", WRITTEN_BY_0_5_3));
    }

    #[test]
    fn a_corrupted_stored_hash_verifies_as_false() {
        assert!(!verify(GOOD, "not a phc string"));
    }
}
