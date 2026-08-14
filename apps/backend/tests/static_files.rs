//! Serving the built frontend, as the container image does.

use std::fs;

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chalendia_backend::config::Config;
use chalendia_backend::http::{AppState, router};
use http_body_util::BodyExt;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

fn unreachable_pool() -> PgPool {
    PgPoolOptions::new()
        .acquire_timeout(std::time::Duration::from_millis(200))
        .connect_lazy("postgres://nobody:nobody@127.0.0.1:1/nothing")
        .expect("a lazy pool is built without connecting")
}

fn config_serving(dir: &str) -> Config {
    let dir = dir.to_owned();
    Config::from_source(move |name| match name {
        "CHALENDIA_PUBLIC_URL" => Some("https://shop.example".to_owned()),
        "DATABASE_URL" => Some("postgres://unused:unused@127.0.0.1:1/unused".to_owned()),
        "CHALENDIA_STATIC_DIR" => Some(dir.clone()),
        _ => None,
    })
    .expect("valid test configuration")
}

async fn get(dir: &str, path: &str) -> (StatusCode, String) {
    let response = router(
        &config_serving(dir),
        AppState {
            db: unreachable_pool(),
            config: config_serving(dir),
        },
    )
    .oneshot(
        Request::builder()
            .uri(path)
            .body(Body::empty())
            .expect("valid request"),
    )
    .await
    .expect("router responds");

    let status = response.status();
    let body = response
        .into_body()
        .collect()
        .await
        .expect("body is readable")
        .to_bytes();

    (status, String::from_utf8_lossy(&body).into_owned())
}

fn built_frontend() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("temporary directory");
    fs::write(
        dir.path().join("index.html"),
        "<!doctype html><html><head></head><body>shell</body></html>",
    )
    .expect("index is written");
    fs::create_dir(dir.path().join("assets")).expect("assets directory");
    fs::write(dir.path().join("assets/app.css"), ":root{}").expect("asset is written");
    dir
}

#[tokio::test]
async fn an_asset_is_served_from_disk() {
    let dir = built_frontend();

    let (status, body) = get(dir.path().to_str().unwrap(), "/assets/app.css").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, ":root{}");
}

#[tokio::test]
async fn an_application_route_falls_back_to_the_shell() {
    let dir = built_frontend();

    // The single-page application owns this path and its own not-found page;
    // answering 404 here would break every deep link into the shop.
    let (status, body) = get(dir.path().to_str().unwrap(), "/some/product/page").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body.contains("shell"));
}

#[tokio::test]
async fn the_shell_carries_the_metadata_of_the_url_asked_for() {
    let dir = built_frontend();

    // What a crawler that runs no JavaScript sees: the page it was linked to,
    // not an empty preview.
    let (_, body) = get(dir.path().to_str().unwrap(), "/some/product/page").await;

    assert!(body.contains("<title>Chalendia</title>"));
    assert!(body.contains(r#"href="https://shop.example/some/product/page""#));
    assert!(body.contains(r#"property="og:url" content="https://shop.example/some/product/page""#));
}

#[tokio::test]
async fn a_crafted_url_cannot_inject_markup_into_the_shell() {
    let dir = built_frontend();

    let (_, body) = get(
        dir.path().to_str().unwrap(),
        "/x%22%3E%3Cscript%3Ealert(1)%3C/script%3E",
    )
    .await;

    assert!(!body.contains("<script>alert(1)</script>"));
}

#[tokio::test]
async fn the_api_still_answers_as_an_api() {
    let dir = built_frontend();

    let (status, body) = get(dir.path().to_str().unwrap(), "/health").await;

    // Degraded because this test uses an unreachable database on purpose: what
    // matters is that the API answered instead of the shell.
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body.contains("\"database\":\"unreachable\""));
}

#[tokio::test]
async fn the_content_type_of_an_asset_is_not_the_shell_one() {
    let dir = built_frontend();

    let response = router(
        &config_serving(dir.path().to_str().unwrap()),
        AppState {
            db: unreachable_pool(),
            config: config_serving(dir.path().to_str().unwrap()),
        },
    )
    .oneshot(
        Request::builder()
            .uri("/assets/app.css")
            .body(Body::empty())
            .expect("valid request"),
    )
    .await
    .expect("router responds");

    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_owned();

    assert!(content_type.starts_with("text/css"), "got {content_type}");
}
