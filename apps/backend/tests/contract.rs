//! The API contract: what is committed, and what the running shop serves.

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chalendia_backend::api;
use chalendia_backend::config::Config;
use chalendia_backend::http::{AppState, router};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

const COMMITTED: &str = include_str!("../api/openapi.json");

fn config() -> Config {
    Config::from_source(|name| match name {
        "CHALENDIA_PUBLIC_URL" => Some("https://shop.example".to_owned()),
        "DATABASE_URL" => Some("postgres://unused:unused@127.0.0.1:1/unused".to_owned()),
        _ => None,
    })
    .expect("valid test configuration")
}

fn pool() -> PgPool {
    PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_millis(200))
        .connect_lazy("postgres://nobody:nobody@127.0.0.1:1/nothing")
        .expect("a lazy pool is built without connecting")
}

#[test]
fn the_committed_contract_is_current() {
    // The generated document is the contract the frontend compiles against. A
    // stale copy means the frontend's types describe an API that no longer
    // exists — caught here rather than in a browser.
    assert_eq!(
        COMMITTED.trim(),
        api::document().trim(),
        "api/openapi.json is stale — run `just api-generate`"
    );
}

#[test]
fn the_contract_describes_every_route_it_should() {
    let document: Value = serde_json::from_str(&api::document()).expect("valid json");
    let paths = document["paths"].as_object().expect("paths object");

    assert!(paths.contains_key("/api/health"));
    assert!(paths.contains_key("/api/openapi.json"));

    // The shapes the frontend generates its types from.
    let schemas = document["components"]["schemas"]
        .as_object()
        .expect("schemas object");
    for schema in ["Health", "Status", "Dependency", "ApiError"] {
        assert!(
            schemas.contains_key(schema),
            "{schema} missing from contract"
        );
    }
}

#[test]
fn health_declares_both_of_its_outcomes() {
    let document: Value = serde_json::from_str(&api::document()).expect("valid json");
    let responses = &document["paths"]["/api/health"]["get"]["responses"];

    // A client must know that 503 is an answer, not a failure to answer.
    assert!(responses["200"].is_object());
    assert!(responses["503"].is_object());
}

#[tokio::test]
async fn the_running_shop_serves_its_own_contract() {
    let response = router(
        &config(),
        AppState {
            db: pool(),
            config: config(),
            // Neither is exercised here; images have their own suite.
            storage: chalendia_backend::storage::Storage::at(std::env::temp_dir()),
            deriver: chalendia_backend::images::Deriver::default(),
        },
    )
    .oneshot(
        Request::builder()
            .uri("/api/openapi.json")
            .body(Body::empty())
            .expect("valid request"),
    )
    .await
    .expect("router responds");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok()),
        Some("application/json")
    );

    let body = response
        .into_body()
        .collect()
        .await
        .expect("body is readable")
        .to_bytes();
    let served: Value = serde_json::from_slice(&body).expect("body is json");

    assert_eq!(served["info"]["title"], "Chalendia");
    assert!(served["paths"]["/api/health"].is_object());
}
