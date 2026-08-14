//! Setup, sign-in and authorization, against a real database.

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chalendia_backend::config::Config;
use chalendia_backend::http::{AppState, router};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

fn config() -> Config {
    Config::from_source(|name| match name {
        "CHALENDIA_PUBLIC_URL" => Some("https://shop.example".to_owned()),
        "DATABASE_URL" => Some("postgres://unused:unused@127.0.0.1:1/unused".to_owned()),
        _ => None,
    })
    .expect("valid test configuration")
}

struct Answer {
    status: StatusCode,
    body: Value,
    set_cookie: Option<String>,
}

async fn call(pool: &PgPool, request: Request<Body>) -> Answer {
    let response = router(
        &config(),
        AppState {
            db: pool.clone(),
            config: config(),
        },
    )
    .oneshot(request)
    .await
    .expect("router responds");

    let status = response.status();
    let set_cookie = response
        .headers()
        .get(header::SET_COOKIE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body is readable")
        .to_bytes();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);

    Answer {
        status,
        body,
        set_cookie,
    }
}

fn post(path: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(path)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .expect("valid request")
}

fn get_with(path: &str, cookie: Option<&str>) -> Request<Body> {
    let builder = Request::builder().uri(path);
    let builder = match cookie {
        Some(cookie) => builder.header(header::COOKIE, cookie),
        None => builder,
    };
    builder.body(Body::empty()).expect("valid request")
}

fn setup_body() -> Value {
    json!({
        "name": "La Fabrique à Savons",
        "legalIdentity": "SIRET 000 000 000 00000",
        "currency": "EUR",
        "contentLanguage": "fr",
        "timezone": "Europe/Paris",
        "vatEnabled": true,
        "administratorEmail": "Owner@Example.COM",
        "administratorPassword": "correct horse battery staple",
    })
}

/// The cookie value as a browser would send it back.
fn session_cookie(answer: &Answer) -> String {
    let set = answer.set_cookie.as_ref().expect("a session cookie");
    set.split(';').next().expect("a name=value pair").to_owned()
}

#[sqlx::test]
async fn an_empty_installation_reports_itself_unconfigured(pool: PgPool) {
    let answer = call(&pool, get_with("/shop", None)).await;

    assert_eq!(answer.status, StatusCode::OK);
    assert_eq!(answer.body["configured"], false);
    // Nothing to tell about a shop that does not exist yet.
    assert!(answer.body.get("name").is_none());
}

#[sqlx::test]
async fn setup_configures_the_shop_and_signs_the_administrator_in(pool: PgPool) {
    let answer = call(&pool, post("/setup", setup_body())).await;

    assert_eq!(answer.status, StatusCode::CREATED);
    assert_eq!(answer.body["configured"], true);
    assert_eq!(answer.body["name"], "La Fabrique à Savons");

    let cookie = answer.set_cookie.expect("a session cookie");
    assert!(
        cookie.contains("HttpOnly"),
        "no script may read it: {cookie}"
    );
    assert!(cookie.contains("SameSite=Lax"), "{cookie}");
    // The test shop's public URL is https, so the cookie must say Secure.
    assert!(cookie.contains("Secure"), "{cookie}");
}

#[sqlx::test]
async fn the_shop_reports_itself_configured_afterwards(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let answer = call(&pool, get_with("/shop", None)).await;

    assert_eq!(answer.body["configured"], true);
    assert_eq!(answer.body["currency"], "EUR");
}

#[sqlx::test]
async fn setup_runs_once_and_is_refused_afterwards(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let second = call(&pool, post("/setup", setup_body())).await;

    // Refused by the shop itself, not merely hidden by the interface: the
    // window where an installation can be claimed closes for good.
    assert_eq!(second.status, StatusCode::CONFLICT);

    let accounts: i64 = sqlx::query_scalar("select count(*) from staff_accounts")
        .fetch_one(&pool)
        .await
        .expect("countable");
    assert_eq!(accounts, 1);
}

#[sqlx::test]
async fn a_short_password_is_refused_and_creates_nothing(pool: PgPool) {
    let mut body = setup_body();
    body["administratorPassword"] = json!("short");

    let answer = call(&pool, post("/setup", body)).await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    let params = answer.body["invalid-params"]
        .as_array()
        .expect("refused fields");
    assert_eq!(params[0]["name"], "administratorPassword");
    // The count of what is missing is what the dots on screen do not show.
    assert!(
        params[0]["reason"]
            .as_str()
            .unwrap()
            .contains("7 characters missing")
    );

    let shops: i64 = sqlx::query_scalar("select count(*) from shops")
        .fetch_one(&pool)
        .await
        .expect("countable");
    assert_eq!(shops, 0, "a refused setup leaves nothing behind");
}

#[sqlx::test]
async fn a_missing_field_is_named(pool: PgPool) {
    let mut body = setup_body();
    body["currency"] = json!("   ");

    let answer = call(&pool, post("/setup", body)).await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    let params = answer.body["invalid-params"]
        .as_array()
        .expect("refused fields");
    assert_eq!(params[0]["name"], "currency");
    // A blank field needs no words: whoever left it empty can see that.
    assert!(params[0]["reason"].is_null());
}

#[sqlx::test]
async fn every_refused_field_is_reported_at_once(pool: PgPool) {
    let mut body = setup_body();
    body["currency"] = json!("");
    body["name"] = json!("  ");
    body["administratorPassword"] = json!("short");

    let answer = call(&pool, post("/setup", body)).await;

    // Correcting one field per submission is how an operator submits five times.
    let names: Vec<String> = answer.body["invalid-params"]
        .as_array()
        .expect("refused fields")
        .iter()
        .map(|param| param["name"].as_str().unwrap().to_owned())
        .collect();

    assert!(names.contains(&"name".to_owned()));
    assert!(names.contains(&"currency".to_owned()));
    assert!(names.contains(&"administratorPassword".to_owned()));
}

#[sqlx::test]
async fn signing_in_works_with_the_address_in_any_case(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let answer = call(
        &pool,
        post(
            "/sessions",
            json!({ "email": "OWNER@example.com", "password": "correct horse battery staple" }),
        ),
    )
    .await;

    assert_eq!(answer.status, StatusCode::OK);
    assert!(answer.set_cookie.is_some());
}

#[sqlx::test]
async fn a_wrong_password_does_not_say_which_half_is_wrong(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let wrong_password = call(
        &pool,
        post(
            "/sessions",
            json!({ "email": "owner@example.com", "password": "not the right one at all" }),
        ),
    )
    .await;
    let unknown_address = call(
        &pool,
        post(
            "/sessions",
            json!({ "email": "nobody@example.com", "password": "correct horse battery staple" }),
        ),
    )
    .await;

    assert_eq!(wrong_password.status, StatusCode::UNAUTHORIZED);
    assert_eq!(unknown_address.status, StatusCode::UNAUTHORIZED);
    // Identical answers: the caller learns the pair does not match, nothing else.
    assert_eq!(
        wrong_password.body["detail"],
        unknown_address.body["detail"]
    );
    assert!(wrong_password.set_cookie.is_none());
}

#[sqlx::test]
async fn a_staff_route_refuses_a_caller_without_a_session(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let answer = call(&pool, get_with("/staff/me", None)).await;

    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn a_staff_route_refuses_an_invented_token(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let answer = call(
        &pool,
        get_with("/staff/me", Some("chalendia_session=not-a-real-token")),
    )
    .await;

    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn a_staff_route_answers_the_signed_in_administrator(pool: PgPool) {
    let created = call(&pool, post("/setup", setup_body())).await;

    let answer = call(
        &pool,
        get_with("/staff/me", Some(&session_cookie(&created))),
    )
    .await;

    assert_eq!(answer.status, StatusCode::OK);
    assert_eq!(answer.body["email"], "owner@example.com");
    assert_eq!(answer.body["role"], "administrator");
}

#[sqlx::test]
async fn signing_out_makes_the_session_unusable(pool: PgPool) {
    let created = call(&pool, post("/setup", setup_body())).await;
    let cookie = session_cookie(&created);

    let signed_out = call(
        &pool,
        Request::builder()
            .method("DELETE")
            .uri("/sessions")
            .header(header::COOKIE, &cookie)
            .body(Body::empty())
            .expect("valid request"),
    )
    .await;
    assert_eq!(signed_out.status, StatusCode::NO_CONTENT);

    // The design requires that signing out invalidates the session everywhere
    // it was usable — which is why sessions are rows, not self-contained tokens.
    let after = call(&pool, get_with("/staff/me", Some(&cookie))).await;
    assert_eq!(after.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn signing_out_without_a_session_says_the_same_thing(pool: PgPool) {
    let answer = call(
        &pool,
        Request::builder()
            .method("DELETE")
            .uri("/sessions")
            .body(Body::empty())
            .expect("valid request"),
    )
    .await;

    // Not a way to find out whether a token was valid.
    assert_eq!(answer.status, StatusCode::NO_CONTENT);
}

#[sqlx::test]
async fn the_stored_password_is_not_the_password(pool: PgPool) {
    call(&pool, post("/setup", setup_body())).await;

    let stored: String = sqlx::query_scalar("select password_hash from staff_accounts limit 1")
        .fetch_one(&pool)
        .await
        .expect("readable");

    assert!(!stored.contains("correct horse"));
    assert!(stored.starts_with("$argon2id$"));
}

#[sqlx::test]
async fn the_stored_session_is_not_the_token(pool: PgPool) {
    let created = call(&pool, post("/setup", setup_body())).await;
    let token = session_cookie(&created)
        .split_once('=')
        .expect("name=value")
        .1
        .to_owned();

    let stored: Vec<u8> = sqlx::query_scalar("select token_hash from sessions limit 1")
        .fetch_one(&pool)
        .await
        .expect("readable");

    assert_ne!(stored, token.as_bytes());
    assert_eq!(stored.len(), 32);
}
