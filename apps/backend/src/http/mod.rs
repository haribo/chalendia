pub mod catalogue;
pub mod error;
pub mod health;
pub mod images;
pub mod setup;
pub mod shell;
pub mod staff;
pub mod tax;

use std::path::{Path, PathBuf};

use axum::extract::State;
use axum::http::{HeaderValue, Method, header};
use axum::response::IntoResponse;
use axum::{Router, routing::get};
use sqlx::postgres::PgPool;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::images::Deriver;
use crate::storage::Storage;
use error::ApiError;

/// What every handler can reach. Cloned per request, so it holds handles, never
/// owned resources.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    /// The one way to a file, so remote object storage is a second
    /// implementation rather than a search through the code
    /// (`docs/adr/0004-v1-release-scope.md`).
    pub storage: Storage,
    /// Woken when an upload leaves an image waiting for its sizes.
    pub deriver: Deriver,
}

/// The whole HTTP surface. Built from configuration so tests exercise the same
/// router the binary serves, middleware included.
pub fn router(config: &Config, state: AppState) -> Router {
    // Everything the API answers lives under /api. Without that prefix an
    // interface route and an API route collide the moment they share a name —
    // `GET /setup` answered "method not allowed" instead of serving the page,
    // and `/products` would have done the same. See backend ADR 0006.
    let api = Router::new()
        .nest(
            "/api",
            Router::new()
                .route("/health", get(health::health))
                .route("/shop", get(setup::read_shop))
                .route("/setup", axum::routing::post(setup::run_setup))
                .route(
                    "/sessions",
                    axum::routing::post(setup::sign_in).delete(setup::sign_out),
                )
                .route("/staff/me", get(staff::me))
                .route(
                    "/products",
                    get(catalogue::list_products).post(catalogue::create_product),
                )
                .route(
                    "/products/{id}/images",
                    get(images::list_images).post(images::add_image).layer(
                        // The default is two megabytes, and the shop accepts
                        // eight. The margin is the multipart framing around
                        // the file, never a second, laxer limit: the file
                        // itself is measured after it is read.
                        axum::extract::DefaultBodyLimit::max(crate::images::MAX_BYTES + 64 * 1024),
                    ),
                )
                .route(
                    "/products/{id}/images/{imageId}",
                    axum::routing::delete(images::remove_image),
                )
                .route(
                    "/products/{id}/images/order",
                    axum::routing::put(images::reorder_images),
                )
                .route("/vat-rates", get(tax::list_rates).post(tax::create_rate))
                .route("/vat-rates/{id}", axum::routing::delete(tax::remove_rate))
                .route(
                    "/vat-rates/{id}/default",
                    axum::routing::put(tax::make_default),
                )
                // The contract, served by the shop itself: a third party
                // writing a client reads it from the running instance.
                .route("/openapi.json", get(openapi_document)),
        )
        // Outside /api on purpose: these are files a page loads, not the API
        // a client calls, and they are the only public thing the shop serves
        // from its own storage.
        .route("/media/images/{reference}/{file}", get(images::serve_image))
        .with_state(state);

    let app = match &config.static_dir {
        // Development: nothing to serve, so an unknown path is an API error.
        None => api.fallback(async || ApiError::not_found()),
        // Container: unknown paths belong to the single-page application, which
        // owns its own routing and its own not-found page.
        Some(dir) => {
            let shell = ShellState {
                index: Path::new(dir).join("index.html"),
                config: config.clone(),
            };
            // Assets come from disk; everything else is an application route,
            // answered with the shell carrying that URL's metadata.
            api.fallback_service(ServeDir::new(dir).fallback(get(serve_shell).with_state(shell)))
        }
    };

    app
        // Without this, a known path called with the wrong method answers 405
        // with an empty body — an error the client cannot read like any other.
        .method_not_allowed_fallback(async || ApiError::method_not_allowed())
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer(config))
}

#[derive(Clone)]
struct ShellState {
    index: PathBuf,
    config: Config,
}

async fn serve_shell(
    State(state): State<ShellState>,
    uri: axum::http::Uri,
) -> axum::response::Response {
    let Ok(index) = tokio::fs::read_to_string(&state.index).await else {
        // The image ships the shell; its absence is a broken deployment, and
        // saying so beats serving a blank page.
        return ApiError::new(
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            "Internal Server Error",
        )
        .with_detail("The application shell is missing from this installation.")
        .into_response();
    };

    let metadata = shell::metadata_for(uri.path(), &state.config);

    (
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        shell::render(&index, &metadata),
    )
        .into_response()
}

/// Serve this API's own contract.
///
/// A third party writing a client reads it from the running instance rather
/// than from the repository, so it always describes the version answering.
#[utoipa::path(
    get,
    path = "/api/openapi.json",
    tag = "system",
    responses((status = 200, description = "The OpenAPI document describing this API")),
)]
pub async fn openapi_document() -> impl axum::response::IntoResponse {
    (
        [(header::CONTENT_TYPE, "application/json")],
        crate::api::document(),
    )
}

fn cors_layer(config: &Config) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        // Safe only because the origins above are an explicit list: credentials
        // with a wildcard origin is exactly the combination browsers refuse.
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
}
