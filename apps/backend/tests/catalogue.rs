//! Creating products and listing them, against a real database.

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

fn post(path: &str, body: Value, cookie: Option<&str>) -> Request<Body> {
    let builder = Request::builder()
        .method("POST")
        .uri(path)
        .header(header::CONTENT_TYPE, "application/json");
    let builder = match cookie {
        Some(cookie) => builder.header(header::COOKIE, cookie),
        None => builder,
    };
    builder
        .body(Body::from(body.to_string()))
        .expect("valid request")
}

fn get(path: &str, cookie: Option<&str>) -> Request<Body> {
    let builder = Request::builder().uri(path);
    let builder = match cookie {
        Some(cookie) => builder.header(header::COOKIE, cookie),
        None => builder,
    };
    builder.body(Body::empty()).expect("valid request")
}

/// Installs the shop and returns the cookie its administrator signs in with.
async fn signed_in_staff(pool: &PgPool) -> String {
    let answer = call(
        pool,
        post(
            "/api/setup",
            json!({
                "name": "La Fabrique à Savons",
                "legalIdentity": "SIRET 000 000 000 00000",
                "currency": "EUR",
                "contentLanguage": "fr",
                "timezone": "Europe/Paris",
                "vatEnabled": true,
                "administratorEmail": "owner@example.com",
                "administratorPassword": "correct horse battery staple",
            }),
            None,
        ),
    )
    .await;

    let set = answer.set_cookie.expect("a session cookie");
    set.split(';').next().expect("a name=value pair").to_owned()
}

/// Signs in again on a shop that already exists — setup only runs once.
async fn sign_in(pool: &PgPool) -> String {
    let answer = call(
        pool,
        post(
            "/api/sessions",
            json!({
                "email": "owner@example.com",
                "password": "correct horse battery staple",
            }),
            None,
        ),
    )
    .await;

    let set = answer.set_cookie.expect("a session cookie");
    set.split(';').next().expect("a name=value pair").to_owned()
}

fn a_product(title: &str, price: i64) -> Value {
    json!({ "title": title, "price": price })
}

#[sqlx::test]
async fn a_new_shop_has_no_products(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let answer = call(&pool, get("/api/products", Some(&cookie))).await;

    assert_eq!(answer.status, StatusCode::OK);
    assert_eq!(answer.body["total"], 0);
    assert_eq!(answer.body["items"], json!([]));
}

#[sqlx::test]
async fn a_created_product_appears_in_the_listing(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let created = call(
        &pool,
        post(
            "/api/products",
            json!({
                "title": "Savon de Marseille",
                "description": "Cube de 300 g, à l'huile d'olive.",
                "price": 690,
                "merchantReference": "SAV-300",
            }),
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(created.status, StatusCode::CREATED);
    // The answer is the listing the merchant lands on.
    assert_eq!(created.body["total"], 1);

    let item = &created.body["items"][0];
    assert_eq!(item["title"], "Savon de Marseille");
    assert_eq!(item["price"], 690);
    assert_eq!(item["merchantReference"], "SAV-300");
    // Draft unless staff said otherwise (docs/design/catalog.md § 7).
    assert_eq!(item["state"], "draft");
    assert_eq!(item["slug"], "savon-de-marseille");
}

#[sqlx::test]
async fn a_product_can_be_published_from_the_start(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let created = call(
        &pool,
        post(
            "/api/products",
            json!({ "title": "Savon au miel", "price": 750, "state": "published" }),
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(created.body["items"][0]["state"], "published");
}

#[sqlx::test]
async fn a_product_cannot_be_created_already_retired(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let answer = call(
        &pool,
        post(
            "/api/products",
            json!({ "title": "Savon", "price": 100, "state": "retired" }),
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(answer.body["invalid-params"][0]["name"], "state");
}

#[sqlx::test]
async fn every_refused_field_comes_back_at_once(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let answer = call(
        &pool,
        post(
            "/api/products",
            json!({ "title": "   ", "price": -1 }),
            Some(&cookie),
        ),
    )
    .await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);

    let refused: Vec<&str> = answer.body["invalid-params"]
        .as_array()
        .expect("a list of refused fields")
        .iter()
        .map(|param| param["name"].as_str().expect("a field name"))
        .collect();
    assert_eq!(refused, vec!["title", "price"]);

    // Both values show their own problem, so neither carries words.
    assert!(answer.body["invalid-params"][0].get("reason").is_none());
}

#[sqlx::test]
async fn two_products_named_alike_get_distinct_addresses(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    call(
        &pool,
        post("/api/products", a_product("Savon", 100), Some(&cookie)),
    )
    .await;
    let second = call(
        &pool,
        post("/api/products", a_product("Savon", 200), Some(&cookie)),
    )
    .await;

    let addresses: Vec<&str> = second.body["items"]
        .as_array()
        .expect("the listing")
        .iter()
        .map(|item| item["slug"].as_str().expect("an address"))
        .collect();
    assert_eq!(addresses, vec!["savon-2", "savon"]);
}

#[sqlx::test]
async fn a_title_in_another_script_still_gets_an_address(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let created = call(
        &pool,
        post("/api/products", a_product("石鹸", 500), Some(&cookie)),
    )
    .await;

    assert_eq!(created.status, StatusCode::CREATED);
    assert_eq!(created.body["items"][0]["slug"], "product-1");
}

#[sqlx::test]
async fn paging_neither_repeats_nor_skips_a_product(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    for number in 1..=5 {
        call(
            &pool,
            post(
                "/api/products",
                a_product(&format!("Savon {number}"), 100 * number),
                Some(&cookie),
            ),
        )
        .await;
    }

    let first = call(&pool, get("/api/products?page=1&pageSize=2", Some(&cookie))).await;
    let second = call(&pool, get("/api/products?page=2&pageSize=2", Some(&cookie))).await;
    let third = call(&pool, get("/api/products?page=3&pageSize=2", Some(&cookie))).await;

    assert_eq!(first.body["total"], 5);

    let seen: Vec<i64> = [&first, &second, &third]
        .iter()
        .flat_map(|answer| {
            answer.body["items"]
                .as_array()
                .expect("the listing")
                .iter()
                .map(|item| item["id"].as_i64().expect("an identifier"))
        })
        .collect();

    let mut sorted = seen.clone();
    sorted.sort_unstable();
    sorted.dedup();
    assert_eq!(sorted.len(), 5, "five distinct products across the pages");

    // Most recently created first, so the last one created leads.
    assert_eq!(first.body["items"][0]["title"], "Savon 5");
}

#[sqlx::test]
async fn a_page_size_beyond_the_maximum_is_brought_back_to_it(pool: PgPool) {
    let cookie = signed_in_staff(&pool).await;

    let answer = call(&pool, get("/api/products?pageSize=100000", Some(&cookie))).await;

    assert_eq!(answer.body["pageSize"], 100);
}

#[sqlx::test]
async fn the_catalogue_is_not_readable_without_a_session(pool: PgPool) {
    signed_in_staff(&pool).await;

    let answer = call(&pool, get("/api/products", None)).await;

    // Drafts and retired products are staff-only by construction.
    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn nobody_creates_a_product_without_a_session(pool: PgPool) {
    signed_in_staff(&pool).await;

    let answer = call(&pool, post("/api/products", a_product("Savon", 100), None)).await;

    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);

    let cookie = sign_in(&pool).await;
    let listing = call(&pool, get("/api/products", Some(&cookie))).await;
    assert_eq!(listing.body["total"], 0, "nothing was created");
}
