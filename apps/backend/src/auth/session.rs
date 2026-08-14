//! Opaque server-side sessions. See `docs/backend/adr/0005-passwords-and-sessions.md`.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;

/// A session dies this long after its last use. Idle sessions expire with
/// nobody acting; active work is never interrupted mid-task.
pub const LIFETIME_HOURS: i64 = 12;

/// 32 bytes from the operating system's generator: the token is the only
/// secret standing between a stranger and an administrator's session.
const TOKEN_BYTES: usize = 32;

pub const COOKIE_NAME: &str = "chalendia_session";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Staff {
    pub id: i64,
    pub email: String,
    pub role: Role,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Administrator,
    Operator,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Administrator => "administrator",
            Self::Operator => "operator",
        }
    }

    /// Not `FromStr`: this reads the value the schema allows, and an
    /// unknown one is data corruption rather than a parse error to surface.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "administrator" => Some(Self::Administrator),
            "operator" => Some(Self::Operator),
            _ => None,
        }
    }
}

/// The token handed to the browser. Held only long enough to be sent: what the
/// shop keeps is its hash.
pub struct IssuedSession {
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

fn generate_token() -> String {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes).expect("the operating system provides randomness");

    URL_SAFE_NO_PAD.encode(bytes)
}

fn digest(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

pub async fn issue(pool: &PgPool, staff_account_id: i64) -> Result<IssuedSession, sqlx::Error> {
    let token = generate_token();
    let expires_at = Utc::now() + Duration::hours(LIFETIME_HOURS);

    sqlx::query!(
        "insert into sessions (token_hash, staff_account_id, expires_at) values ($1, $2, $3)",
        digest(&token),
        staff_account_id,
        expires_at,
    )
    .execute(pool)
    .await?;

    Ok(IssuedSession { token, expires_at })
}

/// Who is asking, if anyone.
///
/// An expired session resolves to nobody, whether or not its row was ever
/// removed: expiry is enforced on read, so a stale row is harmless.
pub async fn authenticate(pool: &PgPool, token: &str) -> Result<Option<Staff>, sqlx::Error> {
    let found = sqlx::query!(
        r#"
        update sessions
           set expires_at = now() + ($2 || ' hours')::interval
          from staff_accounts
         where sessions.token_hash = $1
           and sessions.expires_at > now()
           and staff_accounts.id = sessions.staff_account_id
        returning staff_accounts.id, staff_accounts.email, staff_accounts.role
        "#,
        digest(token),
        LIFETIME_HOURS.to_string(),
    )
    .fetch_optional(pool)
    .await?;

    Ok(found.and_then(|row| {
        Role::from_storage(&row.role).map(|role| Staff {
            id: row.id,
            email: row.email,
            role,
        })
    }))
}

/// Ends this session. Signing out invalidates it everywhere it was usable,
/// which is a design rule (`docs/design/core.md` § 3) and the reason sessions
/// are rows rather than self-contained tokens.
pub async fn revoke(pool: &PgPool, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query!("delete from sessions where token_hash = $1", digest(token))
        .execute(pool)
        .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_tokens_are_never_the_same() {
        assert_ne!(generate_token(), generate_token());
    }

    #[test]
    fn a_token_carries_enough_randomness_to_be_unguessable() {
        // 32 bytes, url-safe base64, no padding.
        assert_eq!(generate_token().len(), 43);
    }

    #[test]
    fn the_digest_is_not_the_token() {
        let token = generate_token();

        assert_ne!(digest(&token), token.as_bytes());
        assert_eq!(digest(&token).len(), 32);
    }

    #[test]
    fn the_same_token_always_digests_the_same_way() {
        let token = generate_token();

        assert_eq!(digest(&token), digest(&token));
    }

    #[test]
    fn a_role_survives_the_round_trip_through_storage() {
        for role in [Role::Administrator, Role::Operator] {
            assert_eq!(Role::from_storage(role.as_str()), Some(role));
        }
    }

    #[test]
    fn an_unknown_role_is_not_invented() {
        assert_eq!(Role::from_storage("superuser"), None);
    }
}
