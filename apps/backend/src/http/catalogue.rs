//! The catalogue routes: creating a product, and listing them for staff.

use axum::Json;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use utoipa::IntoParams;

use crate::catalogue::{self, CatalogueError, DEFAULT_PAGE_SIZE, NewProduct, ProductPage};
use crate::http::AppState;
use crate::http::error::{ApiError, InvalidParam};
use crate::http::staff::CurrentStaff;

#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
pub struct Paging {
    /// One-based. Anything lower is read as the first page.
    pub page: Option<i64>,
    /// Bounded by the shop, not by the caller.
    pub page_size: Option<i64>,
}

/// List the products, most recently created first.
///
/// Staff only: this shows drafts and retired products, which is precisely what
/// the storefront must never do.
#[utoipa::path(
    get,
    path = "/api/products",
    tag = "catalogue",
    params(Paging),
    responses(
        (status = 200, description = "One page of the catalogue", body = ProductPage),
        (status = 401, description = "No live session", body = ApiError),
    ),
)]
pub async fn list_products(
    CurrentStaff(_staff): CurrentStaff,
    State(state): State<AppState>,
    Query(paging): Query<Paging>,
) -> Response {
    let page = paging.page.unwrap_or(1);
    let page_size = paging.page_size.unwrap_or(DEFAULT_PAGE_SIZE);

    match catalogue::list(&state.db, page, page_size).await {
        Ok(page) => Json(page).into_response(),
        Err(error) => {
            tracing::error!("cannot list the products: {error}");
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}

/// Create a product and the single variant carrying its price.
#[utoipa::path(
    post,
    path = "/api/products",
    tag = "catalogue",
    request_body = NewProduct,
    responses(
        (status = 201, description = "The product was created", body = ProductPage),
        (status = 401, description = "No live session", body = ApiError),
        (status = 422, description = "A field was refused", body = ApiError),
    ),
)]
pub async fn create_product(
    CurrentStaff(_staff): CurrentStaff,
    State(state): State<AppState>,
    Json(request): Json<NewProduct>,
) -> Response {
    match catalogue::create(&state.db, request).await {
        // The listing the merchant lands on, rather than a bare identifier: the
        // interface would ask for it in the next breath anyway.
        Ok(_id) => match catalogue::list(&state.db, 1, DEFAULT_PAGE_SIZE).await {
            Ok(page) => (StatusCode::CREATED, Json(page)).into_response(),
            Err(error) => {
                tracing::error!("cannot list the products after creating one: {error}");
                ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                    .into_response()
            }
        },
        Err(CatalogueError::Invalid(problems)) => {
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
        Err(CatalogueError::Unavailable) => {
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}
