//! Who is asking, and what they are allowed to do.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::response::{IntoResponse, Response};
use axum_extra::extract::CookieJar;
use axum_extra::extract::cookie::{Cookie, SameSite};
use serde::Serialize;
use utoipa::ToSchema;

use crate::auth::session::{self, Role, Staff};
use crate::config::Config;
use crate::http::AppState;
use crate::http::error::ApiError;

/// A signed-in staff member. A route taking this extractor cannot be reached
/// without a live session — the check is the server's, and the interface's own
/// guard exists only to avoid offering what would be refused.
pub struct CurrentStaff(pub Staff);

impl FromRequestParts<AppState> for CurrentStaff {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let jar = CookieJar::from_headers(&parts.headers);
        let token = jar
            .get(session::COOKIE_NAME)
            .map(|cookie| cookie.value().to_owned())
            .ok_or_else(|| unauthorized().into_response())?;

        match session::authenticate(&state.db, &token).await {
            Ok(Some(staff)) => Ok(Self(staff)),
            Ok(None) => Err(unauthorized().into_response()),
            Err(error) => {
                tracing::error!("cannot read the session: {error}");
                Err(ApiError::new(
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal Server Error",
                )
                .into_response())
            }
        }
    }
}

/// An administrator. Same mechanism, narrower door.
pub struct CurrentAdministrator(pub Staff);

impl FromRequestParts<AppState> for CurrentAdministrator {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let CurrentStaff(staff) = CurrentStaff::from_request_parts(parts, state).await?;

        match staff.role {
            Role::Administrator => Ok(Self(staff)),
            // Signed in, and not allowed: a distinct answer from "who are you",
            // because the caller can act on one and not on the other.
            Role::Operator => Err(
                ApiError::new(axum::http::StatusCode::FORBIDDEN, "Forbidden")
                    .with_detail("This action is reserved to an administrator.")
                    .into_response(),
            ),
        }
    }
}

fn unauthorized() -> ApiError {
    ApiError::new(axum::http::StatusCode::UNAUTHORIZED, "Unauthorized")
        .with_detail("Sign in to perform this action.")
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StaffIdentity {
    email: String,
    role: String,
}

/// Report who the caller is signed in as.
#[utoipa::path(
    get,
    path = "/api/staff/me",
    tag = "staff",
    responses(
        (status = 200, description = "The signed-in staff member", body = StaffIdentity),
        (status = 401, description = "No live session", body = ApiError),
    ),
)]
pub async fn me(CurrentStaff(staff): CurrentStaff) -> axum::Json<StaffIdentity> {
    axum::Json(StaffIdentity {
        email: staff.email,
        role: staff.role.as_str().to_owned(),
    })
}

/// Builds the session cookie.
///
/// `HttpOnly` so no script can read it, `SameSite=Lax` so it does not ride
/// along with a cross-site form post, and `Secure` whenever the shop is served
/// over HTTPS — omitted otherwise, or a local install over plain HTTP could
/// never sign in.
pub fn session_cookie(config: &Config, token: String) -> Cookie<'static> {
    Cookie::build((session::COOKIE_NAME, token))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(config.public_url.starts_with("https://"))
        .path("/")
        .max_age(time::Duration::hours(session::LIFETIME_HOURS))
        .build()
}

pub fn expired_cookie(config: &Config) -> Cookie<'static> {
    let mut cookie = session_cookie(config, String::new());
    cookie.make_removal();
    cookie
}
