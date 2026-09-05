//! Uploading product photographs, preparing them, and serving them.
//!
//! Against a real database and a real directory: the whole point of this
//! feature is what ends up on disk, and a test that mocks the filesystem
//! asserts nothing about it.

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chalendia_backend::config::Config;
use chalendia_backend::http::{AppState, router};
use chalendia_backend::images::{self, Deriver};
use chalendia_backend::storage::Storage;
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tempfile::TempDir;
use tower::ServiceExt;

/// One shop, its database, and the directory its files land in.
struct Shop {
    pool: PgPool,
    storage: Storage,
    // Held for the length of the test: dropping it removes the directory.
    _media: TempDir,
}

impl Shop {
    fn new(pool: PgPool) -> Self {
        let media = TempDir::new().expect("a directory for this test's files");
        let storage = Storage::at(media.path());

        Self {
            pool,
            storage,
            _media: media,
        }
    }

    fn config(&self) -> Config {
        Config::from_source(|name| match name {
            "CHALENDIA_PUBLIC_URL" => Some("https://shop.example".to_owned()),
            "DATABASE_URL" => Some("postgres://unused:unused@127.0.0.1:1/unused".to_owned()),
            _ => None,
        })
        .expect("valid test configuration")
    }

    async fn call(&self, request: Request<Body>) -> Answer {
        let config = self.config();
        let response = router(
            &config,
            AppState {
                db: self.pool.clone(),
                config: config.clone(),
                storage: self.storage.clone(),
                // Never run here: every test prepares images itself, so what
                // is asserted is the state the test put the shop in.
                deriver: Deriver::default(),
            },
        )
        .oneshot(request)
        .await
        .expect("router responds");

        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body is readable")
            .to_bytes()
            .to_vec();
        let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);

        Answer {
            status,
            headers,
            bytes,
            body,
        }
    }

    /// What the shop's own task does, run once and awaited so the test knows
    /// when it is finished.
    async fn prepare_one(&self) -> bool {
        images::derive_next_pending(&self.pool, &self.storage).await
    }

    /// Every file that exists for one image, by name.
    fn files_of(&self, reference: &str) -> Vec<String> {
        let directory = self.storage.root().join("images").join(reference);
        let Ok(entries) = std::fs::read_dir(directory) else {
            return Vec::new();
        };

        let mut names: Vec<String> = entries
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }
}

struct Answer {
    status: StatusCode,
    headers: axum::http::HeaderMap,
    bytes: Vec<u8>,
    body: Value,
}

impl Answer {
    fn header(&self, name: header::HeaderName) -> String {
        self.headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_owned()
    }
}

/// A JPEG of the asked-for shape, varied enough that an encoder cannot
/// collapse it to nothing.
///
/// The tests that derive use the smallest picture the shop accepts. Encoding
/// is what this suite spends its time on, and a 2400 px source proves nothing
/// about the pipeline that an 800 px one does not.
fn a_jpeg(width: u32, height: u32) -> Vec<u8> {
    let mut canvas = image::RgbImage::new(width, height);
    for (x, y, pixel) in canvas.enumerate_pixels_mut() {
        *pixel = image::Rgb([(x % 256) as u8, (y % 256) as u8, ((x + y) % 256) as u8]);
    }

    let mut bytes = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 90)
        .encode_image(&canvas)
        .expect("the test image encodes");

    bytes
}

const BOUNDARY: &str = "----chalendiatestboundary";

/// A multipart body, built by hand so the test sends exactly what a browser
/// sends rather than what a helper decides to send.
fn upload(
    product_id: i64,
    file_name: &str,
    file: &[u8],
    alternative_text: Option<&str>,
    cookie: &str,
) -> Request<Body> {
    let mut body: Vec<u8> = Vec::new();

    body.extend_from_slice(format!("--{BOUNDARY}\r\n").as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\n\
             Content-Type: image/jpeg\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(file);
    body.extend_from_slice(b"\r\n");

    if let Some(text) = alternative_text {
        body.extend_from_slice(format!("--{BOUNDARY}\r\n").as_bytes());
        body.extend_from_slice(b"Content-Disposition: form-data; name=\"alternativeText\"\r\n\r\n");
        body.extend_from_slice(text.as_bytes());
        body.extend_from_slice(b"\r\n");
    }

    body.extend_from_slice(format!("--{BOUNDARY}--\r\n").as_bytes());

    Request::builder()
        .method("POST")
        .uri(format!("/api/products/{product_id}/images"))
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={BOUNDARY}"),
        )
        .header(header::COOKIE, cookie)
        .body(Body::from(body))
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

/// Installs the shop, signs its administrator in, and creates one product.
async fn a_shop_with_a_product(pool: PgPool) -> (Shop, String, i64) {
    let shop = Shop::new(pool);

    let answer = shop
        .call(post(
            "/api/setup",
            json!({
                "name": "La Fabrique à Savons",
                "legalIdentity": "SIRET 000 000 000 00000",
                "country": "FR",
                "currency": "EUR",
                "contentLanguage": "fr",
                "timezone": "Europe/Paris",
                "vatEnabled": true,
                "administratorEmail": "owner@example.com",
                "administratorPassword": "correct horse battery staple",
            }),
            None,
        ))
        .await;
    let set = answer
        .headers
        .get(header::SET_COOKIE)
        .and_then(|value| value.to_str().ok())
        .expect("a session cookie");
    let cookie = set.split(';').next().expect("a name=value pair").to_owned();

    shop.call(post(
        "/api/products",
        json!({ "title": "Savon au miel", "price": 690 }),
        Some(&cookie),
    ))
    .await;

    let product_id = sqlx::query_scalar!("select id from products order by id limit 1")
        .fetch_one(&shop.pool)
        .await
        .expect("the product exists");

    (shop, cookie, product_id)
}

#[sqlx::test]
async fn an_uploaded_image_is_stored_and_answers_before_it_is_prepared(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(2400, 1600),
            Some("Un savon au miel sur un plan de travail"),
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::CREATED);
    assert_eq!(answer.body["state"], "pending");
    assert_eq!(answer.body["position"], 0);
    assert_eq!(answer.body["width"], 2400);
    assert_eq!(answer.body["height"], 1600);
    assert_eq!(
        answer.body["alternativeText"],
        "Un savon au miel sur un plan de travail"
    );

    // The source, and nothing else yet: the answer came back before the
    // encoding did (`docs/backend/adr/0008-image-pipeline.md`).
    let reference = answer.body["reference"].as_str().expect("a reference");
    assert_eq!(shop.files_of(reference), vec!["source.jpg"]);
}

#[sqlx::test]
async fn preparing_an_image_writes_every_size_and_keeps_the_source(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 600),
            None,
            &cookie,
        ))
        .await;
    let reference = answer.body["reference"]
        .as_str()
        .expect("a reference")
        .to_owned();

    assert!(shop.prepare_one().await, "there was an image to prepare");

    assert_eq!(
        shop.files_of(&reference),
        vec![
            "1400.avif",
            "1400.jpg",
            "200.avif",
            "200.jpg",
            "600.avif",
            "600.jpg",
            // Kept, so a size added later is derived from it rather than asked
            // of the merchant again (`docs/design/catalog.md` § 5).
            "source.jpg",
        ],
    );

    let listed = shop
        .call(get(
            &format!("/api/products/{product_id}/images"),
            Some(&cookie),
        ))
        .await;
    assert_eq!(listed.body[0]["state"], "ready");
}

#[sqlx::test]
async fn nothing_is_left_pending_by_a_restart(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    // An upload whose preparation never ran: exactly what a container stopped
    // mid-encode leaves behind.
    shop.call(upload(
        product_id,
        "savon.jpg",
        &a_jpeg(800, 800),
        None,
        &cookie,
    ))
    .await;

    // What the shop does when it starts, with no upload to wake it.
    assert!(shop.prepare_one().await, "the pending image was taken up");
    assert!(!shop.prepare_one().await, "and there is nothing left");

    let state = sqlx::query_scalar!("select state from product_images limit 1")
        .fetch_one(&shop.pool)
        .await
        .expect("the image exists");
    assert_eq!(state, "ready");
}

#[sqlx::test]
async fn a_preparation_that_cannot_happen_is_visible_rather_than_silent(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 800),
            None,
            &cookie,
        ))
        .await;
    let reference = answer.body["reference"]
        .as_str()
        .expect("a reference")
        .to_owned();

    // The source disappears from under the shop — a disk restored without its
    // files, or an operator tidying a volume.
    std::fs::remove_file(
        shop.storage
            .root()
            .join("images")
            .join(&reference)
            .join("source.jpg"),
    )
    .expect("the source was there");

    assert!(shop.prepare_one().await);
    assert!(
        !shop.prepare_one().await,
        "a failure is recorded, not retried forever"
    );

    let row = sqlx::query!("select state, failure from product_images limit 1")
        .fetch_one(&shop.pool)
        .await
        .expect("the image exists");
    assert_eq!(row.state, "failed");
    assert!(
        row.failure.is_some(),
        "the reason is kept for the interface"
    );
}

#[sqlx::test]
async fn an_image_is_served_from_its_source_while_it_is_being_prepared(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 800),
            None,
            &cookie,
        ))
        .await;
    let reference = answer.body["reference"]
        .as_str()
        .expect("a reference")
        .to_owned();

    // A page written against the served sizes, asked for before a single one
    // exists: it gets a heavy but correct picture, never a hole.
    let while_pending = shop
        .call(get(&format!("/media/images/{reference}/600.avif"), None))
        .await;

    assert_eq!(while_pending.status, StatusCode::OK);
    assert_eq!(while_pending.header(header::CONTENT_TYPE), "image/jpeg");
    assert!(
        !while_pending
            .header(header::CACHE_CONTROL)
            .contains("immutable"),
        "a stand-in must not be cached for a year: {}",
        while_pending.header(header::CACHE_CONTROL),
    );

    shop.prepare_one().await;

    let once_ready = shop
        .call(get(&format!("/media/images/{reference}/600.avif"), None))
        .await;

    assert_eq!(once_ready.status, StatusCode::OK);
    assert_eq!(once_ready.header(header::CONTENT_TYPE), "image/avif");
    assert!(
        once_ready
            .header(header::CACHE_CONTROL)
            .contains("immutable"),
        "a derived file never changes, so it is cacheable forever",
    );
    assert_ne!(
        once_ready.bytes, while_pending.bytes,
        "the derived file replaced the stand-in",
    );
}

#[sqlx::test]
async fn an_image_is_served_without_a_session(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 800),
            None,
            &cookie,
        ))
        .await;
    let reference = answer.body["reference"]
        .as_str()
        .expect("a reference")
        .to_owned();
    shop.prepare_one().await;

    // A customer browsing the shop has no session, and the picture must load.
    let served = shop
        .call(get(&format!("/media/images/{reference}/200.jpg"), None))
        .await;

    assert_eq!(served.status, StatusCode::OK);
    assert_eq!(served.header(header::CONTENT_TYPE), "image/jpeg");

    let decoded = image::load_from_memory(&served.bytes).expect("a readable picture");
    assert_eq!((decoded.width(), decoded.height()), (200, 200));
}

#[sqlx::test]
async fn asking_again_for_an_unchanged_file_costs_a_header_not_the_file(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 800),
            None,
            &cookie,
        ))
        .await;
    let reference = answer.body["reference"]
        .as_str()
        .expect("a reference")
        .to_owned();
    shop.prepare_one().await;

    let first = shop
        .call(get(&format!("/media/images/{reference}/200.avif"), None))
        .await;
    let tag = first.header(header::ETAG);
    assert!(!tag.is_empty(), "the answer carries an entity tag");

    let again = shop
        .call(
            Request::builder()
                .uri(format!("/media/images/{reference}/200.avif"))
                .header(header::IF_NONE_MATCH, &tag)
                .body(Body::empty())
                .expect("valid request"),
        )
        .await;

    assert_eq!(again.status, StatusCode::NOT_MODIFIED);
    assert!(again.bytes.is_empty());
}

#[sqlx::test]
async fn a_picture_too_small_to_serve_is_refused(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(100, 100),
            None,
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(answer.body["type"], "/problems/image-too-small");
    assert_eq!(
        answer.header(header::CONTENT_TYPE),
        "application/problem+json"
    );
    assert!(
        !shop.storage.root().join("images").exists(),
        "a refused upload wrote nothing",
    );
}

#[sqlx::test]
async fn a_picture_larger_than_the_shop_keeps_is_refused(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    // The browser reduces to 2400 px; a client that does not is held to the
    // same line, since a client sends whatever it wants.
    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(2500, 1000),
            None,
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(answer.body["type"], "/problems/image-too-large");
}

#[sqlx::test]
async fn a_file_that_is_not_a_jpeg_is_refused_whatever_it_is_named(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    // A PNG signature under a .jpg name, with a jpeg media type: every label
    // says jpeg and the bytes do not.
    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR and then some",
            None,
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(answer.body["type"], "/problems/image-not-jpeg");
}

#[sqlx::test]
async fn an_eleventh_image_is_refused(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let file = a_jpeg(800, 800);

    for index in 0..10 {
        let answer = shop
            .call(upload(product_id, "savon.jpg", &file, None, &cookie))
            .await;
        assert_eq!(answer.status, StatusCode::CREATED, "image {index}");
        assert_eq!(answer.body["position"], index);
    }

    let refused = shop
        .call(upload(product_id, "savon.jpg", &file, None, &cookie))
        .await;

    assert_eq!(refused.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(refused.body["type"], "/problems/too-many-images");

    let count = sqlx::query_scalar!("select count(*) from product_images")
        .fetch_one(&shop.pool)
        .await
        .expect("counted");
    assert_eq!(count, Some(10));
}

#[sqlx::test]
async fn an_upload_needs_a_session(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let _ = cookie;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 800),
            None,
            "chalendia_session=not-a-session",
        ))
        .await;

    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn an_upload_to_a_product_that_does_not_exist_is_refused(pool: PgPool) {
    let (shop, cookie, _product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            999_999,
            "savon.jpg",
            &a_jpeg(800, 800),
            None,
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::NOT_FOUND);
    assert_eq!(answer.body["type"], "/problems/no-such-product");
}

#[sqlx::test]
async fn removing_an_image_removes_its_files(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(upload(
            product_id,
            "savon.jpg",
            &a_jpeg(800, 450),
            None,
            &cookie,
        ))
        .await;
    let reference = answer.body["reference"]
        .as_str()
        .expect("a reference")
        .to_owned();
    let image_id = answer.body["id"].as_i64().expect("an identifier");
    shop.prepare_one().await;
    assert_eq!(shop.files_of(&reference).len(), 7);

    let removed = shop
        .call(
            Request::builder()
                .method("DELETE")
                .uri(format!("/api/products/{product_id}/images/{image_id}"))
                .header(header::COOKIE, &cookie)
                .body(Body::empty())
                .expect("valid request"),
        )
        .await;

    assert_eq!(removed.status, StatusCode::NO_CONTENT);
    assert!(
        shop.files_of(&reference).is_empty(),
        "the files went with the row",
    );
    let count = sqlx::query_scalar!("select count(*) from product_images")
        .fetch_one(&shop.pool)
        .await
        .expect("counted");
    assert_eq!(count, Some(0));
}

/// Uploads `count` images and returns their identifiers, in the order the
/// shop gave them.
async fn several_images(shop: &Shop, cookie: &str, product_id: i64, count: usize) -> Vec<i64> {
    let file = a_jpeg(800, 800);
    let mut ids = Vec::with_capacity(count);

    for _ in 0..count {
        let answer = shop
            .call(upload(product_id, "savon.jpg", &file, None, cookie))
            .await;
        assert_eq!(answer.status, StatusCode::CREATED);
        ids.push(answer.body["id"].as_i64().expect("an identifier"));
    }

    ids
}

fn put(path: &str, body: Value, cookie: &str) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(path)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::COOKIE, cookie)
        .body(Body::from(body.to_string()))
        .expect("valid request")
}

#[sqlx::test]
async fn the_order_of_a_products_images_can_be_changed(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let ids = several_images(&shop, &cookie, product_id, 3).await;

    let reversed: Vec<i64> = ids.iter().rev().copied().collect();
    let answer = shop
        .call(put(
            &format!("/api/products/{product_id}/images/order"),
            json!({ "imageIds": reversed }),
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::OK);
    let returned: Vec<i64> = answer
        .body
        .as_array()
        .expect("an array")
        .iter()
        .map(|image| image["id"].as_i64().expect("an identifier"))
        .collect();
    assert_eq!(returned, reversed, "the answer carries the new order");

    // And a fresh read agrees: the order was written, not merely echoed.
    let listed = shop
        .call(get(
            &format!("/api/products/{product_id}/images"),
            Some(&cookie),
        ))
        .await;
    let read: Vec<i64> = listed
        .body
        .as_array()
        .expect("an array")
        .iter()
        .map(|image| image["id"].as_i64().expect("an identifier"))
        .collect();
    assert_eq!(read, reversed);
}

#[sqlx::test]
async fn an_order_that_is_not_the_products_images_is_refused(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let ids = several_images(&shop, &cookie, product_id, 3).await;

    for (name, sent) in [
        ("one missing", vec![ids[0], ids[1]]),
        ("one extra", vec![ids[0], ids[1], ids[2], 999_999]),
        ("one repeated", vec![ids[0], ids[1], ids[1]]),
        ("none at all", vec![]),
    ] {
        let answer = shop
            .call(put(
                &format!("/api/products/{product_id}/images/order"),
                json!({ "imageIds": sent }),
                &cookie,
            ))
            .await;

        assert_eq!(answer.status, StatusCode::CONFLICT, "{name} was accepted");
        assert_eq!(
            answer.body["type"], "/problems/not-the-same-images",
            "{name}"
        );
    }

    // Nothing was written by any of the refusals.
    let listed = shop
        .call(get(
            &format!("/api/products/{product_id}/images"),
            Some(&cookie),
        ))
        .await;
    let read: Vec<i64> = listed
        .body
        .as_array()
        .expect("an array")
        .iter()
        .map(|image| image["id"].as_i64().expect("an identifier"))
        .collect();
    assert_eq!(read, ids, "the order a refusal left behind is the old one");
}

#[sqlx::test]
async fn an_order_carrying_another_products_image_is_refused(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let ids = several_images(&shop, &cookie, product_id, 2).await;

    // A second product, with an image of its own.
    shop.call(post(
        "/api/products",
        json!({ "title": "Savon à la lavande", "price": 750 }),
        Some(&cookie),
    ))
    .await;
    let other = sqlx::query_scalar!("select id from products order by id desc limit 1")
        .fetch_one(&shop.pool)
        .await
        .expect("the second product");
    let strangers = several_images(&shop, &cookie, other, 1).await;

    let answer = shop
        .call(put(
            &format!("/api/products/{product_id}/images/order"),
            json!({ "imageIds": [ids[0], strangers[0]] }),
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::CONFLICT);
    assert_eq!(answer.body["type"], "/problems/not-the-same-images");
}

#[sqlx::test]
async fn a_newly_uploaded_image_lands_last_and_survives_a_reorder(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let ids = several_images(&shop, &cookie, product_id, 2).await;

    let reversed: Vec<i64> = ids.iter().rev().copied().collect();
    shop.call(put(
        &format!("/api/products/{product_id}/images/order"),
        json!({ "imageIds": reversed }),
        &cookie,
    ))
    .await;

    let added = several_images(&shop, &cookie, product_id, 1).await;

    let listed = shop
        .call(get(
            &format!("/api/products/{product_id}/images"),
            Some(&cookie),
        ))
        .await;
    let read: Vec<i64> = listed
        .body
        .as_array()
        .expect("an array")
        .iter()
        .map(|image| image["id"].as_i64().expect("an identifier"))
        .collect();

    let mut expected = reversed;
    expected.push(added[0]);
    assert_eq!(read, expected, "the new image is last, the order is kept");
}

#[sqlx::test]
async fn reordering_needs_a_session(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let ids = several_images(&shop, &cookie, product_id, 2).await;

    let answer = shop
        .call(put(
            &format!("/api/products/{product_id}/images/order"),
            json!({ "imageIds": ids }),
            "chalendia_session=not-a-session",
        ))
        .await;

    assert_eq!(answer.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn reordering_a_product_that_does_not_exist_is_refused(pool: PgPool) {
    let (shop, cookie, _product_id) = a_shop_with_a_product(pool).await;

    let answer = shop
        .call(put(
            "/api/products/999999/images/order",
            json!({ "imageIds": [] }),
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::NOT_FOUND);
    assert_eq!(answer.body["type"], "/problems/no-such-product");
}

/// `images/order` sits beside `images/{imageId}`, and a literal segment must
/// win over a parameter — otherwise the order route is read as an image named
/// "order" and answers a parsing failure instead.
#[sqlx::test]
async fn the_order_route_is_not_read_as_an_image_called_order(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    let ids = several_images(&shop, &cookie, product_id, 2).await;

    let answer = shop
        .call(put(
            &format!("/api/products/{product_id}/images/order"),
            json!({ "imageIds": ids }),
            &cookie,
        ))
        .await;

    assert_eq!(answer.status, StatusCode::OK);
}

#[sqlx::test]
async fn a_path_that_walks_out_of_the_volume_reaches_nothing(pool: PgPool) {
    let (shop, cookie, product_id) = a_shop_with_a_product(pool).await;
    shop.call(upload(
        product_id,
        "savon.jpg",
        &a_jpeg(800, 800),
        None,
        &cookie,
    ))
    .await;
    shop.prepare_one().await;

    // A file that exists, next to the volume rather than inside it.
    let outside = shop.storage.root().join("secret.jpg");
    std::fs::write(&outside, b"not for the world").expect("the bait is written");

    for attempt in [
        "/media/images/../secret.jpg/200.jpg",
        "/media/images/..%2Fsecret.jpg/200.jpg",
        "/media/images/....//secret.jpg/200.jpg",
        // The right shape, a name the shop never generates.
        "/media/images/0123456789abcdef0123456789abcdef/200.jpg",
        // A file name the shop does not derive.
        "/media/images/0123456789abcdef0123456789abcdef/source.jpg",
    ] {
        let answer = shop.call(get(attempt, None)).await;

        assert_ne!(answer.status, StatusCode::OK, "{attempt} was served");
        assert!(
            !answer.bytes.windows(9).any(|window| window == b"not for t"),
            "{attempt} reached a file outside the volume",
        );
    }

    assert!(outside.exists(), "the bait was not touched");
}

#[sqlx::test]
async fn a_file_over_the_limit_is_refused_before_it_is_decoded(pool: PgPool) {
    let (shop, _cookie, product_id) = a_shop_with_a_product(pool).await;

    // Not a picture at all: the size is measured first, so nothing here is
    // ever decoded. Building nine megabytes of real JPEG to assert the same
    // thing would cost seconds per run.
    let too_heavy = vec![0u8; images::MAX_BYTES + 1];

    let refused = images::add(&shop.pool, &shop.storage, product_id, too_heavy, None).await;

    assert_eq!(
        refused.unwrap_err(),
        images::ImageError::TooHeavy {
            bytes: images::MAX_BYTES + 1
        },
    );
}
