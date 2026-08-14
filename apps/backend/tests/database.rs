//! The schema lifecycle, against a real PostgreSQL instance.

use chalendia_backend::db;
use sqlx::PgPool;

async fn function_exists(pool: &PgPool, name: &str) -> bool {
    sqlx::query_scalar::<_, bool>("select exists (select 1 from pg_proc where proname = $1)")
        .bind(name)
        .fetch_one(pool)
        .await
        .expect("catalog is readable")
}

async fn applied_migrations(pool: &PgPool) -> Vec<(i64, bool)> {
    sqlx::query_as::<_, (i64, bool)>(
        "select version, success from _sqlx_migrations order by version",
    )
    .fetch_all(pool)
    .await
    .expect("migration table is readable")
}

#[sqlx::test(migrations = false)]
async fn an_empty_database_is_brought_to_the_expected_schema(pool: PgPool) {
    assert!(!function_exists(&pool, "set_updated_at").await);

    db::migrate(&pool).await.expect("migrations apply");

    assert!(function_exists(&pool, "set_updated_at").await);

    // Every migration succeeded, and there is at least one. Asserting an exact
    // list would make this test fail on the next migration, which is not what
    // it is guarding.
    let applied = applied_migrations(&pool).await;
    assert!(!applied.is_empty());
    assert!(applied.iter().all(|(_, success)| *success));
}

#[sqlx::test(migrations = false)]
async fn migrating_an_already_migrated_database_changes_nothing(pool: PgPool) {
    db::migrate(&pool).await.expect("migrations apply");
    let after_first = applied_migrations(&pool).await;

    db::migrate(&pool).await.expect("second run is a no-op");

    assert_eq!(applied_migrations(&pool).await, after_first);
}

#[sqlx::test]
async fn the_pool_answers_once_the_schema_is_in_place(pool: PgPool) {
    assert!(db::is_reachable(&pool).await);
}
