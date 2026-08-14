//! Every error the API returns has one shape, described by RFC 9457.
//! See `docs/backend/adr/0003-problem-details-errors.md`.

use axum::Json;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use utoipa::ToSchema;

pub const PROBLEM_JSON: &str = "application/problem+json";

/// One refused field, in the shape RFC 9457 reserves for exactly this.
///
/// `reason` is present only when it says something the submitted value does not
/// already show: "already taken" yes, "this address is malformed" no — the
/// client can see that.
#[derive(Debug, Serialize, ToSchema)]
pub struct InvalidParam {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiError {
    /// Machine-readable identifier of the problem kind. `about:blank` means the
    /// status code alone describes it.
    #[serde(rename = "type")]
    kind: &'static str,
    title: &'static str,
    status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
    /// Every field refused, not merely the first one met: a caller correcting
    /// one field at a time is a caller submitting five times.
    #[serde(rename = "invalid-params", skip_serializing_if = "Option::is_none")]
    invalid_params: Option<Vec<InvalidParam>>,
    #[serde(skip)]
    #[schema(ignore)]
    status_code: StatusCode,
}

impl ApiError {
    pub fn new(status_code: StatusCode, title: &'static str) -> Self {
        Self {
            kind: "about:blank",
            title,
            status: status_code.as_u16(),
            detail: None,
            invalid_params: None,
            status_code,
        }
    }

    pub fn with_invalid_params(mut self, params: Vec<InvalidParam>) -> Self {
        self.invalid_params = Some(params);
        self
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "Not Found").with_detail("No route matches this path.")
    }

    pub fn method_not_allowed() -> Self {
        Self::new(StatusCode::METHOD_NOT_ALLOWED, "Method Not Allowed")
            .with_detail("This path exists but does not answer this method.")
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status_code;
        let mut response = (status, Json(self)).into_response();
        response
            .headers_mut()
            .insert(header::CONTENT_TYPE, HeaderValue::from_static(PROBLEM_JSON));
        response
    }
}
