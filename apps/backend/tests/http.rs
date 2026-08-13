//! Exercises the router the binary serves, middleware included.

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chalendia_backend::config::Config;
use chalendia_backend::http::error::PROBLEM_JSON;
use chalendia_backend::http::router;
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt;

fn config() -> Config {
    Config::from_source(|name| match name {
        "CHALENDIA_PUBLIC_URL" => Some("https://shop.example".to_owned()),
        _ => None,
    })
    .expect("valid test configuration")
}

async fn call(request: Request<Body>) -> (StatusCode, Option<String>, Value) {
    let response = router(&config())
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

#[tokio::test]
async fn health_reports_the_service_as_up() {
    let (status, content_type, body) = call(get("/health")).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(content_type.as_deref(), Some("application/json"));
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "chalendia-backend");
}

#[tokio::test]
async fn an_unknown_route_answers_in_the_api_error_shape() {
    let (status, content_type, body) = call(get("/nothing-here")).await;

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

    let (status, content_type, body) = call(request).await;

    assert_eq!(status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(content_type.as_deref(), Some(PROBLEM_JSON));
    assert_eq!(body["status"], 405);
}
