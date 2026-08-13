use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Health {
    status: &'static str,
    service: &'static str,
}

/// Liveness only: it answers whether the process serves requests. Database
/// readiness is reported here too once the database exists.
pub async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        service: env!("CARGO_PKG_NAME"),
    })
}
