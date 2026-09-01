//! The VAT rate routes. Administrator only: an operator manages the catalogue,
//! not what the shop charges (`docs/design/core.md` § 2).

use axum::Json;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

use crate::http::AppState;
use crate::http::error::{ApiError, InvalidParam};
use crate::http::staff::{CurrentAdministrator, CurrentStaff};
use crate::tax::{self, NewVatRate, TaxError, VatRate};

/// List the rates the shop charges.
///
/// Readable by any staff member: the product form has to offer them.
#[utoipa::path(
    get,
    path = "/api/vat-rates",
    tag = "tax",
    responses(
        (status = 200, description = "The rates, highest first", body = Vec<VatRate>),
        (status = 401, description = "No live session", body = ApiError),
    ),
)]
pub async fn list_rates(
    CurrentStaff(_staff): CurrentStaff,
    State(state): State<AppState>,
) -> Response {
    match tax::list(&state.db).await {
        Ok(rates) => Json(rates).into_response(),
        Err(error) => {
            tracing::error!("cannot list the vat rates: {error}");
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}

/// Add a rate.
#[utoipa::path(
    post,
    path = "/api/vat-rates",
    tag = "tax",
    request_body = NewVatRate,
    responses(
        (status = 201, description = "The rates, the new one among them", body = Vec<VatRate>),
        (status = 401, description = "No live session", body = ApiError),
        (status = 403, description = "Reserved to an administrator", body = ApiError),
        (status = 422, description = "A field was refused", body = ApiError),
    ),
)]
pub async fn create_rate(
    CurrentAdministrator(_staff): CurrentAdministrator,
    State(state): State<AppState>,
    Json(request): Json<NewVatRate>,
) -> Response {
    match tax::create(&state.db, request).await {
        Ok(_id) => match tax::list(&state.db).await {
            Ok(rates) => (StatusCode::CREATED, Json(rates)).into_response(),
            Err(_) => ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response(),
        },
        Err(error) => refusal(error),
    }
}

/// Remove a rate, unless products carry it.
#[utoipa::path(
    delete,
    path = "/api/vat-rates/{id}",
    tag = "tax",
    params(("id" = i64, Path, description = "The rate to remove")),
    responses(
        (status = 204, description = "It is gone"),
        (status = 401, description = "No live session", body = ApiError),
        (status = 403, description = "Reserved to an administrator", body = ApiError),
        (status = 404, description = "No such rate", body = ApiError),
        (status = 409, description = "Products carry it", body = ApiError),
    ),
)]
pub async fn remove_rate(
    CurrentAdministrator(_staff): CurrentAdministrator,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match tax::remove(&state.db, id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => refusal(error),
    }
}

/// Make a rate the shop default.
#[utoipa::path(
    put,
    path = "/api/vat-rates/{id}/default",
    tag = "tax",
    params(("id" = i64, Path, description = "The rate to make default")),
    responses(
        (status = 200, description = "The rates, with the default moved", body = Vec<VatRate>),
        (status = 401, description = "No live session", body = ApiError),
        (status = 403, description = "Reserved to an administrator", body = ApiError),
        (status = 404, description = "No such rate", body = ApiError),
    ),
)]
pub async fn make_default(
    CurrentAdministrator(_staff): CurrentAdministrator,
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Response {
    match tax::set_default(&state.db, id).await {
        Ok(()) => match tax::list(&state.db).await {
            Ok(rates) => Json(rates).into_response(),
            Err(_) => ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response(),
        },
        Err(error) => refusal(error),
    }
}

/// The shop's answer, in the shape every other refusal takes.
fn refusal(error: TaxError) -> Response {
    match error {
        TaxError::Invalid(problems) => {
            ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "Unprocessable Entity")
                .with_detail("Some fields were refused.")
                .with_invalid_params(
                    problems
                        .into_iter()
                        .map(|problem| InvalidParam {
                            name: problem.field.to_owned(),
                            reason: problem.reason,
                        })
                        .collect(),
                )
                .into_response()
        }
        // How many, not which: a shop can have two hundred on one rate
        // (`docs/design/core.md` § 6). The count travels as a number, and the
        // interface writes the sentence in the reader's language.
        TaxError::InUse { products } => ApiError::new(StatusCode::CONFLICT, "Conflict")
            .with_dependents(products)
            .into_response(),
        TaxError::Unknown => ApiError::not_found().into_response(),
        TaxError::Unavailable => {
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}
