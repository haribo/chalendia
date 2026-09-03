//! The shop's own configuration, and the setup that creates it.

use std::sync::LazyLock;

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;

use crate::auth::password;
use crate::auth::session::Role;
// The same shape every refusal takes, wherever it is refused.
pub use crate::validation::FieldProblem;
use crate::validation::required;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShopState {
    /// Until this is true, setup is the only thing the shop will do.
    pub configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Absent on an installation that predates the column, never guessed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    /// Whether any screen has a tax amount to show at all
    /// (`docs/design/core.md` § 6).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vat_enabled: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetupRequest {
    pub name: String,
    pub legal_identity: String,
    /// ISO 3166-1 alpha-2. Decides which VAT rates the shop may charge
    /// (`docs/design/core.md` § 4, § 6).
    pub country: String,
    pub currency: String,
    pub content_language: String,
    pub timezone: String,
    pub vat_enabled: bool,
    pub administrator_email: String,
    pub administrator_password: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum SetupError {
    AlreadyConfigured,
    /// Every field refused, collected in one pass: correcting one at a time is
    /// what makes an operator submit five times.
    Invalid(Vec<FieldProblem>),
}

/// A real hash, computed once, for candidates that match no account.
static DECOY_HASH: LazyLock<String> =
    LazyLock::new(|| password::hash("a password nobody signs in with"));

pub async fn state(pool: &PgPool) -> Result<ShopState, sqlx::Error> {
    let shop = sqlx::query!(
        "select name, currency, country, content_language, timezone, vat_enabled from shops limit 1"
    )
    .fetch_optional(pool)
    .await?;

    Ok(match shop {
        None => ShopState {
            configured: false,
            name: None,
            currency: None,
            country: None,
            content_language: None,
            timezone: None,
            vat_enabled: None,
        },
        Some(row) => ShopState {
            configured: true,
            name: Some(row.name),
            currency: Some(row.currency),
            country: row.country,
            content_language: Some(row.content_language),
            timezone: Some(row.timezone),
            vat_enabled: Some(row.vat_enabled),
        },
    })
}

/// Normalized the way the design requires: email is the login identifier,
/// unique per shop, lowercased (`docs/design/core.md` § 3).
pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

/// Deliberately shallow: the only real proof an address exists is a message
/// arriving at it, which the design already relies on for customers. This
/// catches what a person can see is wrong — a missing half, a domain with no
/// dot — and refuses to pretend it does more.
pub fn looks_like_an_email(value: &str) -> bool {
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };

    !local.is_empty()
        && !domain.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && !value.contains(char::is_whitespace)
}

/// Creates the shop and its first administrator, or nothing at all.
///
/// One transaction: a shop with no administrator would be unreachable, and an
/// administrator with no shop would be an account on nothing.
pub async fn setup(pool: &PgPool, request: SetupRequest) -> Result<i64, SetupError> {
    let mut problems = Vec::new();

    let name = required(&request.name, "name", &mut problems);
    let legal_identity = required(&request.legal_identity, "legalIdentity", &mut problems);
    let country = required(&request.country, "country", &mut problems);
    let currency = required(&request.currency, "currency", &mut problems);
    let content_language = required(&request.content_language, "contentLanguage", &mut problems);
    let timezone = required(&request.timezone, "timezone", &mut problems);
    let email = normalize_email(&request.administrator_email);
    let email = required(&email, "administratorEmail", &mut problems);
    if !email.is_empty() && !looks_like_an_email(&email) {
        // No words: whoever typed it can see what is missing.
        problems.push(FieldProblem::blank("administratorEmail"));
    }

    match password::check(
        &request.administrator_password,
        &[
            &request.administrator_email,
            &request.name,
            &request.legal_identity,
        ],
    ) {
        Ok(()) => {}
        Err(password::PasswordError::TooShort { .. }) => {
            // Too short shows its own problem: the field is marked, and the
            // interface says nothing (`docs/design/core.md` § 3).
            problems.push(FieldProblem::blank("administratorPassword"));
        }
        Err(password::PasswordError::Guessable { reason }) => {
            // The identifier, never a sentence: the shop does not know the
            // reader's language.
            problems.push(FieldProblem::saying(
                "administratorPassword",
                reason.as_str(),
            ));
        }
    }

    if !problems.is_empty() {
        return Err(SetupError::Invalid(problems));
    }

    let hash = password::hash(&request.administrator_password);

    let mut transaction = pool
        .begin()
        .await
        .map_err(|_| SetupError::AlreadyConfigured)?;

    let existing = sqlx::query!("select 1 as present from shops limit 1")
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| SetupError::AlreadyConfigured)?;
    if existing.is_some() {
        return Err(SetupError::AlreadyConfigured);
    }

    sqlx::query!(
        "insert into shops (name, legal_identity, country, currency, content_language, timezone, vat_enabled)
         values ($1, $2, $3, $4, $5, $6, $7)",
        name,
        legal_identity,
        country,
        currency,
        content_language,
        timezone,
        request.vat_enabled,
    )
    .execute(&mut *transaction)
    .await
    .map_err(|_| SetupError::AlreadyConfigured)?;

    let account = sqlx::query!(
        "insert into staff_accounts (email, password_hash, role) values ($1, $2, $3) returning id",
        email,
        hash,
        Role::Administrator.as_str(),
    )
    .fetch_one(&mut *transaction)
    .await
    .map_err(|_| SetupError::AlreadyConfigured)?;

    transaction
        .commit()
        .await
        .map_err(|_| SetupError::AlreadyConfigured)?;

    Ok(account.id)
}

/// Verifies a sign-in and returns the account it belongs to.
///
/// The same answer whether the address is unknown or the password is wrong: the
/// caller learns that the pair does not match, and nothing else
/// (`docs/design/core.md` § 3).
pub async fn authenticate(
    pool: &PgPool,
    email: &str,
    candidate: &str,
) -> Result<Option<i64>, sqlx::Error> {
    let account = sqlx::query!(
        "select id, password_hash from staff_accounts where email = $1",
        normalize_email(email),
    )
    .fetch_optional(pool)
    .await?;

    Ok(match account {
        Some(row) if password::verify(candidate, &row.password_hash) => Some(row.id),
        // An unknown address still costs a real verification, so the two
        // outcomes are not told apart by how long the answer takes. Against a
        // malformed digest the check would return immediately, which is the
        // timing signal this exists to remove.
        _ => {
            password::verify(candidate, &DECOY_HASH);
            None
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_address_a_person_can_see_is_broken_is_refused() {
        for candidate in [
            "owner@",
            "@example.com",
            "owner",
            "owner@example",
            "own er@example.com",
        ] {
            assert!(
                !looks_like_an_email(candidate),
                "{candidate} should be refused"
            );
        }
    }

    #[test]
    fn an_ordinary_address_passes() {
        for candidate in ["owner@example.com", "o.wner+shop@sub.example.co.uk"] {
            assert!(looks_like_an_email(candidate), "{candidate} should pass");
        }
    }

    #[test]
    fn an_email_is_normalized_for_comparison() {
        assert_eq!(normalize_email("  Owner@Example.COM "), "owner@example.com");
    }

    #[test]
    fn a_blank_field_is_reported_by_name_and_without_words() {
        let mut problems = Vec::new();

        required("   ", "name", &mut problems);

        assert_eq!(
            problems,
            vec![FieldProblem {
                field: "name",
                reason: None
            }]
        );
    }

    #[test]
    fn a_filled_field_reports_nothing() {
        let mut problems = Vec::new();

        let value = required("  La Fabrique  ", "name", &mut problems);

        assert_eq!(value, "La Fabrique");
        assert!(problems.is_empty());
    }
}
