//! Configuration is read once, at startup, and is never re-read afterwards.
//!
//! Reading is expressed over a source function rather than over the process
//! environment directly: tests set variables through the source instead of
//! mutating global state, which they cannot do concurrently.

use std::fmt;
use std::net::SocketAddr;

/// Every variable the backend reads. Keep `.env.example` in step with it.
pub const PUBLIC_URL: &str = "CHALENDIA_PUBLIC_URL";
pub const BIND: &str = "CHALENDIA_BIND";
pub const CORS_ORIGINS: &str = "CHALENDIA_CORS_ORIGINS";
/// Unprefixed on purpose: it is the name the whole ecosystem uses, from
/// container images to hosted database providers to the sqlx tooling that
/// verifies our queries.
pub const DATABASE_URL: &str = "DATABASE_URL";
pub const DATABASE_MAX_CONNECTIONS: &str = "CHALENDIA_DATABASE_MAX_CONNECTIONS";

const DEFAULT_BIND: &str = "127.0.0.1:8080";
/// Small on purpose: the target is one shop on a modest server, where each
/// connection costs the database more than it buys the shop.
const DEFAULT_DATABASE_MAX_CONNECTIONS: u32 = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    /// Where the shop answers from the outside. Emails, canonical URLs and
    /// payment redirections are built from it, so it cannot be guessed.
    pub public_url: String,
    pub bind: SocketAddr,
    /// Origins allowed to call the API from a browser. Never a wildcard.
    pub cors_origins: Vec<String>,
    pub database_url: String,
    pub database_max_connections: u32,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    Missing(&'static str),
    Invalid { name: &'static str, reason: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Missing(name) => write!(f, "{name} is required and is not set"),
            Self::Invalid { name, reason } => write!(f, "{name} is invalid: {reason}"),
        }
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_source(|name| std::env::var(name).ok())
    }

    pub fn from_source(source: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let public_url = read(&source, PUBLIC_URL).ok_or(ConfigError::Missing(PUBLIC_URL))?;
        let public_url = normalize_url(PUBLIC_URL, &public_url)?;

        let bind = read(&source, BIND).unwrap_or_else(|| DEFAULT_BIND.to_owned());
        let bind = bind
            .parse::<SocketAddr>()
            .map_err(|err| ConfigError::Invalid {
                name: BIND,
                reason: format!("expected host:port, got {bind:?} ({err})"),
            })?;

        let cors_origins = match read(&source, CORS_ORIGINS) {
            // Without an explicit list, the only browser origin that can reach
            // the API is the shop itself — the safe default, never a wildcard.
            None => vec![public_url.clone()],
            Some(raw) => raw
                .split(',')
                .map(|origin| normalize_url(CORS_ORIGINS, origin))
                .collect::<Result<Vec<_>, _>>()?,
        };

        let database_url = read(&source, DATABASE_URL).ok_or(ConfigError::Missing(DATABASE_URL))?;
        if !database_url.starts_with("postgres://") && !database_url.starts_with("postgresql://") {
            return Err(ConfigError::Invalid {
                name: DATABASE_URL,
                reason: "expected a postgres:// connection url".to_owned(),
            });
        }

        let database_max_connections = match read(&source, DATABASE_MAX_CONNECTIONS) {
            None => DEFAULT_DATABASE_MAX_CONNECTIONS,
            Some(raw) => raw
                .parse::<u32>()
                .ok()
                .filter(|value| *value > 0)
                .ok_or_else(|| ConfigError::Invalid {
                    name: DATABASE_MAX_CONNECTIONS,
                    reason: format!("expected a positive whole number, got {raw:?}"),
                })?,
        };

        Ok(Self {
            public_url,
            bind,
            cors_origins,
            database_url,
            database_max_connections,
        })
    }
}

/// An empty or whitespace-only variable is the same mistake as an unset one,
/// and a caller that sets `FOO=` deserves the same message.
fn read(source: &impl Fn(&str) -> Option<String>, name: &str) -> Option<String> {
    source(name)
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn normalize_url(name: &'static str, raw: &str) -> Result<String, ConfigError> {
    let value = raw.trim().trim_end_matches('/');

    if value.is_empty() {
        return Err(ConfigError::Missing(name));
    }
    if value == "*" {
        return Err(ConfigError::Invalid {
            name,
            reason: "a wildcard origin is not accepted".to_owned(),
        });
    }
    if !value.starts_with("http://") && !value.starts_with("https://") {
        return Err(ConfigError::Invalid {
            name,
            reason: format!("expected an http:// or https:// URL, got {value:?}"),
        });
    }

    Ok(value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    const A_DATABASE_URL: &str = "postgres://user:pass@localhost/chalendia";

    fn source(pairs: &[(&'static str, &'static str)]) -> impl Fn(&str) -> Option<String> + use<> {
        let pairs = pairs.to_vec();
        move |name| {
            pairs
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| (*value).to_owned())
        }
    }

    /// Every required variable set to a valid value. A test that is not about a
    /// required variable starts from here and overrides only what it examines.
    fn complete(pairs: &[(&'static str, &'static str)]) -> impl Fn(&str) -> Option<String> + use<> {
        let mut all = vec![
            (PUBLIC_URL, "https://shop.example"),
            (DATABASE_URL, A_DATABASE_URL),
        ];
        all.retain(|(key, _)| !pairs.iter().any(|(given, _)| given == key));
        all.extend_from_slice(pairs);
        source(&all)
    }

    #[test]
    fn public_url_is_required() {
        let error = Config::from_source(source(&[(DATABASE_URL, A_DATABASE_URL)])).unwrap_err();

        assert_eq!(error, ConfigError::Missing(PUBLIC_URL));
        assert!(error.to_string().contains(PUBLIC_URL));
    }

    #[test]
    fn an_empty_variable_is_treated_as_missing() {
        let error = Config::from_source(complete(&[(PUBLIC_URL, "   ")])).unwrap_err();

        assert_eq!(error, ConfigError::Missing(PUBLIC_URL));
    }

    #[test]
    fn defaults_apply_when_only_the_required_variables_are_set() {
        let config = Config::from_source(complete(&[])).unwrap();

        assert_eq!(config.bind, DEFAULT_BIND.parse::<SocketAddr>().unwrap());
        assert_eq!(config.cors_origins, vec!["https://shop.example".to_owned()]);
        assert_eq!(
            config.database_max_connections,
            DEFAULT_DATABASE_MAX_CONNECTIONS
        );
    }

    #[test]
    fn the_database_url_is_required() {
        let error =
            Config::from_source(source(&[(PUBLIC_URL, "https://shop.example")])).unwrap_err();

        assert_eq!(error, ConfigError::Missing(DATABASE_URL));
        assert!(error.to_string().contains(DATABASE_URL));
    }

    #[test]
    fn a_database_url_of_another_engine_is_refused() {
        let error = Config::from_source(complete(&[(DATABASE_URL, "mysql://user@localhost/shop")]))
            .unwrap_err();

        assert!(matches!(error, ConfigError::Invalid { name, .. } if name == DATABASE_URL));
    }

    #[test]
    fn a_pool_size_of_zero_is_refused() {
        let error = Config::from_source(complete(&[(DATABASE_MAX_CONNECTIONS, "0")])).unwrap_err();

        assert!(
            matches!(error, ConfigError::Invalid { name, .. } if name == DATABASE_MAX_CONNECTIONS)
        );
    }

    #[test]
    fn a_pool_size_that_is_not_a_number_is_refused() {
        let error =
            Config::from_source(complete(&[(DATABASE_MAX_CONNECTIONS, "many")])).unwrap_err();

        assert!(
            matches!(error, ConfigError::Invalid { name, .. } if name == DATABASE_MAX_CONNECTIONS)
        );
    }

    #[test]
    fn a_trailing_slash_never_changes_the_public_url() {
        let config =
            Config::from_source(complete(&[(PUBLIC_URL, "https://shop.example/")])).unwrap();

        assert_eq!(config.public_url, "https://shop.example");
    }

    #[test]
    fn cors_origins_are_split_and_trimmed() {
        let config = Config::from_source(complete(&[(
            CORS_ORIGINS,
            "https://shop.example , http://localhost:5173/",
        )]))
        .unwrap();

        assert_eq!(
            config.cors_origins,
            vec![
                "https://shop.example".to_owned(),
                "http://localhost:5173".to_owned(),
            ]
        );
    }

    #[test]
    fn a_wildcard_origin_is_refused() {
        let error = Config::from_source(complete(&[(CORS_ORIGINS, "*")])).unwrap_err();

        assert!(matches!(error, ConfigError::Invalid { name, .. } if name == CORS_ORIGINS));
    }

    #[test]
    fn an_origin_without_a_scheme_is_refused() {
        let error = Config::from_source(complete(&[(CORS_ORIGINS, "shop.example")])).unwrap_err();

        assert!(matches!(error, ConfigError::Invalid { name, .. } if name == CORS_ORIGINS));
    }

    #[test]
    fn a_bind_address_that_is_not_host_port_is_refused() {
        let error = Config::from_source(complete(&[(BIND, "8080")])).unwrap_err();

        assert!(matches!(error, ConfigError::Invalid { name, .. } if name == BIND));
        assert!(error.to_string().contains(BIND));
    }
}
