pub mod error;
pub mod health;

use axum::http::{HeaderValue, Method, header};
use axum::{Router, routing::get};
use sqlx::postgres::PgPool;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::config::Config;
use error::ApiError;

/// What every handler can reach. Cloned per request, so it holds handles, never
/// owned resources.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

/// The whole HTTP surface. Built from configuration so tests exercise the same
/// router the binary serves, middleware included.
pub fn router(config: &Config, state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .fallback(async || ApiError::not_found())
        // Without this, a known path called with the wrong method answers 405
        // with an empty body — an error the client cannot read like any other.
        .method_not_allowed_fallback(async || ApiError::method_not_allowed())
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer(config))
        .with_state(state)
}

fn cors_layer(config: &Config) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
}
