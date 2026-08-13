//! The API contract, derived from the handlers and types that serve it.
//!
//! Generated, never hand-written: the schemas come from the very types that are
//! serialized, so the document cannot misdescribe a response body. See
//! `docs/backend/adr/0002-code-first-openapi.md`.

use utoipa::OpenApi;

use crate::http::error::ApiError;
use crate::http::health::{Dependency, Health, Status};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Chalendia",
        description = "HTTP API of a self-hosted shop. Published with each release so \
                       anyone can write another client.",
        license(name = "AGPL-3.0-only", url = "https://www.gnu.org/licenses/agpl-3.0.html"),
    ),
    paths(crate::http::health::health, crate::http::openapi_document),
    components(schemas(Health, Status, Dependency, ApiError)),
    tags(
        (name = "system", description = "Liveness and diagnosis"),
    ),
)]
pub struct ApiDoc;

/// The document as it is committed and published — pretty-printed so a diff on
/// it is readable in review.
pub fn document() -> String {
    ApiDoc::openapi()
        .to_pretty_json()
        .expect("the derived document serializes")
}
