use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use utoipa::ToSchema;

use crate::db;
use crate::http::AppState;

#[derive(Debug, Serialize, ToSchema)]
pub struct Health {
    status: Status,
    service: String,
    database: Dependency,
}

#[derive(Debug, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Ok,
    Degraded,
}

#[derive(Debug, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Dependency {
    Up,
    Unreachable,
}

/// Report whether the shop is serving and whether it can reach its database.
///
/// A running shop that cannot reach its database is a distinct situation from a
/// stopped one, and an operator's supervision has to tell them apart. The status
/// code follows the aggregate — a degraded instance answers 503 so a proxy stops
/// routing to it — while the body says which part failed.
#[utoipa::path(
    get,
    path = "/health",
    tag = "system",
    responses(
        (status = 200, description = "The shop is serving and its database answers", body = Health),
        (status = 503, description = "The shop is serving but its database does not answer", body = Health),
    ),
)]
pub async fn health(State(state): State<AppState>) -> Response {
    let database = if db::is_reachable(&state.db).await {
        Dependency::Up
    } else {
        Dependency::Unreachable
    };

    let (status, code) = match database {
        Dependency::Up => (Status::Ok, StatusCode::OK),
        Dependency::Unreachable => (Status::Degraded, StatusCode::SERVICE_UNAVAILABLE),
    };

    (
        code,
        Json(Health {
            status,
            service: env!("CARGO_PKG_NAME").to_owned(),
            database,
        }),
    )
        .into_response()
}
