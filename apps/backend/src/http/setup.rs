//! Setup and sessions: the routes that create the shop and prove who is asking.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum_extra::extract::CookieJar;
use serde::Deserialize;
use utoipa::ToSchema;

use crate::auth::session;
use crate::http::AppState;
use crate::http::error::{ApiError, InvalidParam};
use crate::http::staff::{expired_cookie, session_cookie};
use crate::shop::{self, SetupError, SetupRequest, ShopState};

/// Report whether this installation has been set up.
///
/// Public and unauthenticated on purpose: the interface has to know whether to
/// show the setup screen before anyone can possibly be signed in. It exposes
/// the shop's public identity and nothing else.
#[utoipa::path(
    get,
    path = "/api/shop",
    tag = "shop",
    responses((status = 200, description = "The shop's public state", body = ShopState)),
)]
pub async fn read_shop(State(state): State<AppState>) -> Response {
    match shop::state(&state.db).await {
        Ok(shop) => Json(shop).into_response(),
        Err(error) => {
            tracing::error!("cannot read the shop: {error}");
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}

/// Configure the shop and create its first administrator.
///
/// Runs once. Once a shop is configured this is refused by the shop itself, not
/// merely hidden by the interface (`docs/design/core.md` § 3).
#[utoipa::path(
    post,
    path = "/api/setup",
    tag = "shop",
    request_body = SetupRequest,
    responses(
        (status = 201, description = "The shop is configured and the administrator is signed in", body = ShopState),
        (status = 409, description = "This shop is already configured", body = ApiError),
        (status = 422, description = "A field is missing or the password is too short", body = ApiError),
    ),
)]
pub async fn run_setup(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(request): Json<SetupRequest>,
) -> Response {
    let account_id = match shop::setup(&state.db, request).await {
        Ok(id) => id,
        Err(SetupError::AlreadyConfigured) => {
            return ApiError::new(StatusCode::CONFLICT, "Conflict")
                .with_detail("This shop is already configured.")
                .into_response();
        }
        Err(SetupError::Invalid(problems)) => {
            return ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "Unprocessable Entity")
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
                .into_response();
        }
    };

    sign_in_response(&state, jar, account_id, StatusCode::CREATED).await
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct Credentials {
    pub email: String,
    pub password: String,
}

/// Sign in.
#[utoipa::path(
    post,
    path = "/api/sessions",
    tag = "staff",
    request_body = Credentials,
    responses(
        (status = 200, description = "Signed in", body = ShopState),
        (status = 401, description = "The address and password do not match", body = ApiError),
    ),
)]
pub async fn sign_in(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(credentials): Json<Credentials>,
) -> Response {
    match shop::authenticate(&state.db, &credentials.email, &credentials.password).await {
        Ok(Some(account_id)) => sign_in_response(&state, jar, account_id, StatusCode::OK).await,
        Ok(None) => ApiError::new(StatusCode::UNAUTHORIZED, "Unauthorized")
            // Never which half is wrong (`docs/design/core.md` § 3).
            .with_detail("The address and password do not match.")
            .into_response(),
        Err(error) => {
            tracing::error!("cannot verify the credentials: {error}");
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}

/// Sign out, ending this session everywhere it was usable.
#[utoipa::path(
    delete,
    path = "/api/sessions",
    tag = "staff",
    responses((status = 204, description = "The session is over, whether or not there was one")),
)]
pub async fn sign_out(State(state): State<AppState>, jar: CookieJar) -> Response {
    if let Some(cookie) = jar.get(session::COOKIE_NAME)
        && let Err(error) = session::revoke(&state.db, cookie.value()).await
    {
        tracing::error!("cannot revoke the session: {error}");
    }

    // Answers the same whether or not a session existed: signing out is not a
    // way to find out whether a token was valid.
    (
        StatusCode::NO_CONTENT,
        jar.add(expired_cookie(&state.config)),
    )
        .into_response()
}

async fn sign_in_response(
    state: &AppState,
    jar: CookieJar,
    account_id: i64,
    status: StatusCode,
) -> Response {
    let issued = match session::issue(&state.db, account_id).await {
        Ok(issued) => issued,
        Err(error) => {
            tracing::error!("cannot open a session: {error}");
            return ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response();
        }
    };

    let shop_state = match shop::state(&state.db).await {
        Ok(shop) => shop,
        Err(error) => {
            tracing::error!("cannot read the shop: {error}");
            return ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response();
        }
    };

    (
        status,
        jar.add(session_cookie(&state.config, issued.token)),
        Json(shop_state),
    )
        .into_response()
}
