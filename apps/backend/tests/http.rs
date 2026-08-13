//! Exercises the router the binary serves, middleware included.

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chalendia_backend::config::Config;
use chalendia_backend::http::error::PROBLEM_JSON;
use chalendia_backend::http::{AppState, router};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

fn config() -> Config {
    Config::from_source(|name| match name {
        "CHALENDIA_PUBLIC_URL" => Some("https://shop.example".to_owned()),
        "DATABASE_URL" => Some("postgres://unused:unused@127.0.0.1:1/unused".to_owned()),
        _ => None,
    })
    .expect("valid test configuration")
}

/// A pool pointing at a port nothing listens on. Lazy, so building it succeeds
/// and every query against it fails — which is the situation being tested.
fn unreachable_pool() -> PgPool {
    PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_millis(200))
        .connect_lazy("postgres://nobody:nobody@127.0.0.1:1/nothing")
        .expect("a lazy pool is built without connecting")
}

async fn call(pool: PgPool, request: Request<Body>) -> (StatusCode, Option<String>, Value) {
    let response = router(&config(), AppState { db: pool })
        .oneshot(request)
        .await
        .expect("router responds");

    let status = response.status();
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let body = response
        .into_body()
        .collect()
        .await
        .expect("body is readable")
        .to_bytes();
    let body: Value = serde_json::from_slice(&body).expect("body is json");

    (status, content_type, body)
}

fn get(path: &str) -> Request<Body> {
    Request::builder()
        .uri(path)
        .body(Body::empty())
        .expect("valid request")
}

#[sqlx::test]
async fn health_reports_the_service_and_its_database_as_up(pool: PgPool) {
    let (status, content_type, body) = call(pool, get("/health")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(content_type.as_deref(), Some("application/json"));
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "chalendia-backend");
    assert_eq!(body["database"], "up");
}

#[tokio::test]
async fn health_reports_a_degraded_service_when_the_database_is_unreachable() {
    let (status, _, body) = call(unreachable_pool(), get("/health")).await;

    // 503 so a proxy stops routing to this instance, while the body still says
    // the process itself answered.
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["status"], "degraded");
    assert_eq!(body["database"], "unreachable");
    assert_eq!(body["service"], "chalendia-backend");
}

#[tokio::test]
async fn an_unknown_route_answers_in_the_api_error_shape() {
    let (status, content_type, body) = call(unreachable_pool(), get("/nothing-here")).await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(content_type.as_deref(), Some(PROBLEM_JSON));
    assert_eq!(body["status"], 404);
    assert_eq!(body["title"], "Not Found");
    assert_eq!(body["type"], "about:blank");
    assert!(body["detail"].is_string());
}

#[tokio::test]
async fn an_unknown_method_on_a_known_path_answers_in_the_api_error_shape() {
    let request = Request::builder()
        .method("DELETE")
        .uri("/health")
        .body(Body::empty())
        .expect("valid request");

    let (status, content_type, body) = call(unreachable_pool(), request).await;

    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(content_type.as_deref(), Some(PROBLEM_JSON));
    assert_eq!(body["status"], 405);
}
