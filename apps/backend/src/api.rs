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
    paths(
        crate::http::health::health,
        crate::http::openapi_document,
        crate::http::setup::read_shop,
        crate::http::setup::run_setup,
        crate::http::setup::sign_in,
        crate::http::setup::sign_out,
        crate::http::staff::me,
        crate::http::catalogue::list_products,
        crate::http::catalogue::create_product,
        crate::http::tax::list_rates,
        crate::http::tax::create_rate,
        crate::http::tax::remove_rate,
        crate::http::tax::make_default,
    ),
    components(schemas(
        Health,
        Status,
        Dependency,
        ApiError,
        crate::http::error::InvalidParam,
        crate::shop::ShopState,
        crate::shop::SetupRequest,
        crate::http::setup::Credentials,
        crate::http::staff::StaffIdentity,
        crate::catalogue::NewProduct,
        crate::catalogue::ProductPage,
        crate::catalogue::ProductSummary,
        crate::catalogue::ProductState,
        crate::tax::VatRate,
        crate::tax::NewVatRate,
    )),
    tags(
        (name = "system", description = "Liveness and diagnosis"),
        (name = "shop", description = "The shop's own configuration"),
        (name = "staff", description = "Signing in and who is signed in"),
        (name = "catalogue", description = "Products and what they are sold as"),
        (name = "tax", description = "The rates the shop charges"),
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
