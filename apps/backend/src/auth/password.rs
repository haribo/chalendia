//! Password hashing and verification. See `docs/backend/adr/0005-passwords-and-sessions.md`.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, Salt, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};

/// The minimum the design states to the user before they submit
/// (`docs/design/core.md` § 3). Length is the only rule: composition rules
/// push people toward predictable substitutions without adding entropy.
pub const MINIMUM_LENGTH: usize = 12;

/// OWASP's current recommendation for Argon2id: 19 MiB, two passes, one lane.
/// Raising these is a code change — an operator lowering a security parameter
/// through configuration is a footgun, not a feature.
const MEMORY_KIB: u32 = 19 * 1024;
const ITERATIONS: u32 = 2;
const PARALLELISM: u32 = 1;

#[derive(Debug, PartialEq, Eq)]
pub enum PasswordError {
    TooShort { minimum: usize },
}

fn argon2() -> Argon2<'static> {
    let params = Params::new(MEMORY_KIB, ITERATIONS, PARALLELISM, None)
        .expect("the compiled-in Argon2 parameters are valid");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Rejects what the design refuses, before anything is stored.
pub fn check(password: &str) -> Result<(), PasswordError> {
    // Counted in characters, not bytes: a passphrase in any script gets the
    // same rule, and a byte count would quietly demand fewer of them.
    if password.chars().count() < MINIMUM_LENGTH {
        return Err(PasswordError::TooShort {
            minimum: MINIMUM_LENGTH,
        });
    }

    Ok(())
}

/// Returns the PHC string to store. Never returns the password, and the
/// password never reaches a log or an error on the way.
pub fn hash(password: &str) -> String {
    // The salt is drawn here rather than through the hasher's own helper: that
    // helper wants a generator from an older `rand_core` than the rest of the
    // tree, and bridging two versions of a randomness trait to save four lines
    // is how a security-relevant dependency graph becomes unreadable.
    let mut salt_bytes = [0u8; Salt::RECOMMENDED_LENGTH];
    getrandom::fill(&mut salt_bytes).expect("the operating system provides randomness");
    let salt = SaltString::encode_b64(&salt_bytes).expect("a recommended-length salt encodes");

    argon2()
        .hash_password(password.as_bytes(), &salt)
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

    #[test]
    fn a_password_shorter_than_the_minimum_is_refused() {
        let error = check("shorty").unwrap_err();

        assert_eq!(
            error,
            PasswordError::TooShort {
                minimum: MINIMUM_LENGTH
            }
        );
    }

    #[test]
    fn length_is_counted_in_characters_not_bytes() {
        // Twelve characters, twenty-four bytes: the rule is about the password,
        // not about its encoding.
        assert!(check("écoutéécouté").is_ok());
    }

    #[test]
    fn a_long_passphrase_needs_nothing_else() {
        assert!(check("correct horse battery staple").is_ok());
    }

    #[test]
    fn a_password_verifies_against_its_own_hash() {
        let stored = hash("correct horse battery staple");

        assert!(verify("correct horse battery staple", &stored));
    }

    #[test]
    fn another_password_does_not() {
        let stored = hash("correct horse battery staple");

        assert!(!verify("Correct horse battery staple", &stored));
    }

    #[test]
    fn the_same_password_hashes_differently_every_time() {
        // Per-password salt: two accounts sharing a password must not share a
        // digest, or one cracked hash reveals both.
        assert_ne!(
            hash("correct horse battery staple"),
            hash("correct horse battery staple")
        );
    }

    #[test]
    fn the_stored_hash_reveals_neither_the_password_nor_a_bare_digest() {
        let stored = hash("correct horse battery staple");

        assert!(!stored.contains("correct horse"));
        assert!(stored.starts_with("$argon2id$"));
    }

    #[test]
    fn a_corrupted_stored_hash_verifies_as_false() {
        assert!(!verify("correct horse battery staple", "not a phc string"));
    }
}
