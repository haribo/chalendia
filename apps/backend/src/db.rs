//! Database access: one pool, created at startup, and the schema it expects.

use std::time::Duration;

use sqlx::migrate::MigrateError;
use sqlx::postgres::{PgPool, PgPoolOptions};

use crate::config::Config;

/// Applied at startup, before the first request is served. Embedded in the
/// binary, so an operator upgrading the image never runs a migration command.
static MIGRATIONS: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

/// Connecting does not open a connection: the pool is lazy, so a database that
/// is briefly unavailable at boot does not prevent the process from starting
/// and reporting its own state.
pub fn pool(config: &Config) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .acquire_timeout(Duration::from_secs(5))
        .connect_lazy(&config.database_url)
}

pub async fn migrate(pool: &PgPool) -> Result<(), MigrateError> {
    MIGRATIONS.run(pool).await
}

/// Whether the database answers right now. Used by the health endpoint, which
/// must distinguish a process that is up from one that can actually work.
pub async fn is_reachable(pool: &PgPool) -> bool {
    sqlx::query!("select 1 as ok").fetch_one(pool).await.is_ok()
}
