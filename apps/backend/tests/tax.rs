//! VAT rates: who may manage them, and what the shop refuses.

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
            // Neither is exercised here; images have their own suite.
            storage: chalendia_backend::storage::Storage::at(std::env::temp_dir()),
            deriver: chalendia_backend::images::Deriver::default(),
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

fn with(method: &str, path: &str, body: Option<Value>, cookie: Option<&str>) -> Request<Body> {
    let builder = Request::builder().method(method).uri(path);
    let builder = match cookie {
        Some(cookie) => builder.header(header::COOKIE, cookie),
        None => builder,
    };

    match body {
        Some(body) => builder
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .expect("valid request"),
        None => builder.body(Body::empty()).expect("valid request"),
    }
}

async fn administrator(pool: &PgPool) -> String {
    let answer = call(
        pool,
        with(
            "POST",
            "/api/setup",
            Some(json!({
                "name": "La Fabrique à Savons",
                "legalIdentity": "SIRET 000 000 000 00000",
                "country": "FR",
                "currency": "EUR",
                "contentLanguage": "fr",
                "timezone": "Europe/Paris",
                "vatEnabled": true,
                "administratorEmail": "owner@example.com",
                "administratorPassword": "correct horse battery staple",
            })),
            None,
        ),
    )
    .await;

    let set = answer.set_cookie.expect("a session cookie");
    set.split(';').next().expect("a name=value pair").to_owned()
}

async fn add(pool: &PgPool, cookie: &str, name: &str, basis_points: i32) -> Answer {
    call(
        pool,
        with(
            "POST",
            "/api/vat-rates",
            Some(json!({ "name": name, "basisPoints": basis_points })),
            Some(cookie),
        ),
    )
    .await
}

#[sqlx::test]
async fn a_new_shop_charges_no_rate_yet(pool: PgPool) {
    let cookie = administrator(&pool).await;

    let answer = call(&pool, with("GET", "/api/vat-rates", None, Some(&cookie))).await;

    assert_eq!(answer.status, StatusCode::OK);
    assert_eq!(answer.body, json!([]));
}

/// A shop with rates and no default has products pointing at nothing.
#[sqlx::test]
async fn the_first_rate_is_the_default_whatever_was_asked(pool: PgPool) {
    let cookie = administrator(&pool).await;

    let answer = add(&pool, &cookie, "Standard", 2000).await;

    assert_eq!(answer.status, StatusCode::CREATED);
    assert_eq!(answer.body[0]["isDefault"], true);
}

#[sqlx::test]
async fn rates_read_highest_first(pool: PgPool) {
    let cookie = administrator(&pool).await;

    add(&pool, &cookie, "Réduit", 550).await;
    let answer = add(&pool, &cookie, "Standard", 2000).await;

    let names: Vec<&str> = answer
        .body
        .as_array()
        .expect("the rates")
        .iter()
        .map(|rate| rate["name"].as_str().expect("a name"))
        .collect();
    assert_eq!(names, vec!["Standard", "Réduit"]);
}

#[sqlx::test]
async fn one_rate_is_default_at_a_time(pool: PgPool) {
    let cookie = administrator(&pool).await;

    add(&pool, &cookie, "Standard", 2000).await;
    let rates = add(&pool, &cookie, "Réduit", 550).await;
    let reduced = rates
        .body
        .as_array()
        .expect("the rates")
        .iter()
        .find(|rate| rate["name"] == "Réduit")
        .expect("the reduced rate")["id"]
        .as_i64()
        .expect("an identifier");

    let answer = call(
        &pool,
        with(
            "PUT",
            &format!("/api/vat-rates/{reduced}/default"),
            None,
            Some(&cookie),
        ),
    )
    .await;

    let defaults: Vec<&str> = answer
        .body
        .as_array()
        .expect("the rates")
        .iter()
        .filter(|rate| rate["isDefault"] == true)
        .map(|rate| rate["name"].as_str().expect("a name"))
        .collect();
    assert_eq!(defaults, vec!["Réduit"]);
}

#[sqlx::test]
async fn two_rates_cannot_share_a_name(pool: PgPool) {
    let cookie = administrator(&pool).await;

    add(&pool, &cookie, "Standard", 2000).await;
    let answer = add(&pool, &cookie, "Standard", 550).await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(answer.body["invalid-params"][0]["name"], "name");
}

#[sqlx::test]
async fn every_refused_field_comes_back_at_once(pool: PgPool) {
    let cookie = administrator(&pool).await;

    let answer = call(
        &pool,
        with(
            "POST",
            "/api/vat-rates",
            Some(json!({ "name": "  ", "basisPoints": 12000 })),
            Some(&cookie),
        ),
    )
    .await;

    let refused: Vec<&str> = answer.body["invalid-params"]
        .as_array()
        .expect("a list of refused fields")
        .iter()
        .map(|param| param["name"].as_str().expect("a field name"))
        .collect();
    assert_eq!(refused, vec!["name", "basisPoints"]);
}

#[sqlx::test]
async fn a_rate_products_carry_is_refused_with_how_many(pool: PgPool) {
    let cookie = administrator(&pool).await;
    let rates = add(&pool, &cookie, "Standard", 2000).await;
    let rate = rates.body[0]["id"].as_i64().expect("an identifier");

    for title in ["Savon", "Coffret"] {
        call(
            &pool,
            with(
                "POST",
                "/api/products",
                Some(json!({ "title": title, "price": 500, "vatRateId": rate })),
                Some(&cookie),
            ),
        )
        .await;
    }

    let answer = call(
        &pool,
        with(
            "DELETE",
            &format!("/api/vat-rates/{rate}"),
            None,
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(answer.status, StatusCode::CONFLICT);
    // How many, never which — and as a number, since the shop does not know
    // the reader's language and "1 products" is what writing prose here costs.
    assert_eq!(answer.body["dependents"], 2);
    assert!(answer.body["detail"].is_null(), "{:?}", answer.body);
}

#[sqlx::test]
async fn a_rate_nobody_carries_is_removed(pool: PgPool) {
    let cookie = administrator(&pool).await;
    let rates = add(&pool, &cookie, "Standard", 2000).await;
    let rate = rates.body[0]["id"].as_i64().expect("an identifier");

    let answer = call(
        &pool,
        with(
            "DELETE",
            &format!("/api/vat-rates/{rate}"),
            None,
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(answer.status, StatusCode::NO_CONTENT);

    let listing = call(&pool, with("GET", "/api/vat-rates", None, Some(&cookie))).await;
    assert_eq!(listing.body, json!([]));
}

/// A product points at the rate, never at the number: correcting a rate that
/// changed by law moves every product carrying it.
#[sqlx::test]
async fn a_product_reads_the_shop_default_when_it_carries_none(pool: PgPool) {
    let cookie = administrator(&pool).await;
    add(&pool, &cookie, "Standard", 2000).await;

    let created = call(
        &pool,
        with(
            "POST",
            "/api/products",
            Some(json!({ "title": "Savon", "price": 690 })),
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(created.body["items"][0]["vatBasisPoints"], 2000);
}

#[sqlx::test]
async fn a_product_reads_its_own_rate_over_the_default(pool: PgPool) {
    let cookie = administrator(&pool).await;
    add(&pool, &cookie, "Standard", 2000).await;
    let rates = add(&pool, &cookie, "Réduit", 550).await;
    let reduced = rates
        .body
        .as_array()
        .expect("the rates")
        .iter()
        .find(|rate| rate["name"] == "Réduit")
        .expect("the reduced rate")["id"]
        .as_i64()
        .expect("an identifier");

    let created = call(
        &pool,
        with(
            "POST",
            "/api/products",
            Some(json!({ "title": "Savon", "price": 750, "vatRateId": reduced })),
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(created.body["items"][0]["vatBasisPoints"], 550);
}

#[sqlx::test]
async fn nobody_manages_rates_without_a_session(pool: PgPool) {
    administrator(&pool).await;

    let answer = call(
        &pool,
        with(
            "POST",
            "/api/vat-rates",
            Some(json!({ "name": "Standard", "basisPoints": 2000 })),
            None,
        ),
    )
    .await;

    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);
}
