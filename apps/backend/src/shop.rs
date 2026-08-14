//! The shop's own configuration, and the setup that creates it.

use std::sync::LazyLock;

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;

use crate::auth::password;
use crate::auth::session::Role;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ShopState {
    /// Until this is true, setup is the only thing the shop will do.
    pub configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_language: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetupRequest {
    pub name: String,
    pub legal_identity: String,
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
    PasswordTooShort { minimum: usize },
    MissingField { field: &'static str },
}

/// A real hash, computed once, for candidates that match no account.
static DECOY_HASH: LazyLock<String> =
    LazyLock::new(|| password::hash("a password nobody signs in with"));

pub async fn state(pool: &PgPool) -> Result<ShopState, sqlx::Error> {
    let shop = sqlx::query!("select name, currency, content_language from shops limit 1")
        .fetch_optional(pool)
        .await?;

    Ok(match shop {
        None => ShopState {
            configured: false,
            name: None,
            currency: None,
            content_language: None,
        },
        Some(row) => ShopState {
            configured: true,
            name: Some(row.name),
            currency: Some(row.currency),
            content_language: Some(row.content_language),
        },
    })
}

/// Normalized the way the design requires: email is the login identifier,
/// unique per shop, lowercased (`docs/design/core.md` § 3).
pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn required(value: &str, field: &'static str) -> Result<String, SetupError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(SetupError::MissingField { field });
    }
    Ok(value.to_owned())
}

/// Creates the shop and its first administrator, or nothing at all.
///
/// One transaction: a shop with no administrator would be unreachable, and an
/// administrator with no shop would be an account on nothing.
pub async fn setup(pool: &PgPool, request: SetupRequest) -> Result<i64, SetupError> {
    let name = required(&request.name, "name")?;
    let legal_identity = required(&request.legal_identity, "legalIdentity")?;
    let currency = required(&request.currency, "currency")?;
    let content_language = required(&request.content_language, "contentLanguage")?;
    let timezone = required(&request.timezone, "timezone")?;
    let email = normalize_email(&request.administrator_email);
    let email = required(&email, "administratorEmail")?;

    password::check(&request.administrator_password).map_err(|error| match error {
        password::PasswordError::TooShort { minimum } => SetupError::PasswordTooShort { minimum },
    })?;

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
        "insert into shops (name, legal_identity, currency, content_language, timezone, vat_enabled)
         values ($1, $2, $3, $4, $5, $6)",
        name,
        legal_identity,
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
    fn an_email_is_normalized_for_comparison() {
        assert_eq!(normalize_email("  Owner@Example.COM "), "owner@example.com");
    }

    #[test]
    fn a_blank_field_is_reported_by_name() {
        assert_eq!(
            required("   ", "name").unwrap_err(),
            SetupError::MissingField { field: "name" }
        );
    }
}
