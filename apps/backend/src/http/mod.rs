pub mod error;
pub mod health;

use std::path::Path;

use axum::http::{HeaderValue, Method, header};
use axum::{Router, routing::get};
use sqlx::postgres::PgPool;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
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
    let api = Router::new()
        .route("/health", get(health::health))
        .with_state(state);

    let app = match &config.static_dir {
        // Development: nothing to serve, so an unknown path is an API error.
        None => api.fallback(async || ApiError::not_found()),
        // Container: unknown paths belong to the single-page application, which
        // owns its own routing and its own not-found page.
        Some(dir) => {
            let index = Path::new(dir).join("index.html");
            api.fallback_service(ServeDir::new(dir).fallback(ServeFile::new(index)))
        }
    };

    app
        // Without this, a known path called with the wrong method answers 405
        // with an empty body — an error the client cannot read like any other.
        .method_not_allowed_fallback(async || ApiError::method_not_allowed())
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer(config))
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
