//! Uploading a product's photographs, and serving the files they became.

use axum::Json;
use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};

use crate::http::AppState;
use crate::http::error::ApiError;
use crate::http::staff::CurrentStaff;
use crate::images::{self, ImageError, MAX_BYTES, MAX_PER_PRODUCT, ProductImage};
use crate::storage::{Format, ImageReference, Size, entity_tag};

/// A derived file never changes: a new upload is a new reference, so a stale
/// copy in a cache is impossible rather than merely unlikely.
const IMMUTABLE: &str = "public, max-age=31536000, immutable";
/// What is served while the sizes are still being derived is the source
/// standing in for them, and it is replaced within seconds.
const WHILE_PREPARING: &str = "public, max-age=5";

/// Every image of one product, in the order they are shown.
#[utoipa::path(
    get,
    path = "/api/products/{id}/images",
    tag = "catalogue",
    params(("id" = i64, Path, description = "The product")),
    responses(
        (status = 200, description = "The product's images", body = Vec<ProductImage>),
        (status = 401, description = "No live session", body = ApiError),
    ),
)]
pub async fn list_images(
    CurrentStaff(_staff): CurrentStaff,
    State(state): State<AppState>,
    Path(product_id): Path<i64>,
) -> Response {
    match images::list(&state.db, product_id).await {
        Ok(images) => Json(images).into_response(),
        Err(error) => {
            tracing::error!("cannot list the images of product {product_id}: {error}");
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}

/// Add one photograph to a product.
///
/// Multipart, with a `file` part carrying the JPEG and an optional
/// `alternativeText` part. The answer comes back before the sizes the shop
/// serves are derived, and says so: the image is `pending`
/// (`docs/backend/adr/0008-image-pipeline.md`).
#[utoipa::path(
    post,
    path = "/api/products/{id}/images",
    tag = "catalogue",
    params(("id" = i64, Path, description = "The product")),
    request_body(content = String, content_type = "multipart/form-data"),
    responses(
        (status = 201, description = "Stored, and being prepared", body = ProductImage),
        (status = 400, description = "type: /problems/malformed-upload", body = ApiError),
        (status = 401, description = "No live session", body = ApiError),
        (status = 404, description = "type: /problems/no-such-product", body = ApiError),
        (status = 413, description = "type: /problems/image-too-heavy", body = ApiError),
        (
            status = 422,
            description = "type: /problems/image-not-jpeg, /problems/image-too-small, \
                           /problems/image-too-large, /problems/too-many-images, \
                           /problems/image-missing",
            body = ApiError,
        ),
    ),
)]
pub async fn add_image(
    CurrentStaff(_staff): CurrentStaff,
    State(state): State<AppState>,
    Path(product_id): Path<i64>,
    mut form: Multipart,
) -> Response {
    let mut file: Option<Vec<u8>> = None;
    let mut alternative_text: Option<String> = None;

    loop {
        let field = match form.next_field().await {
            Ok(Some(field)) => field,
            Ok(None) => break,
            // A body over the layer's limit surfaces here, and so does a
            // malformed one. Answering both in the shape every other failure
            // uses is what ADR 0003 requires of any layer that can reject a
            // request.
            Err(error) => return unreadable(&error),
        };

        match field.name().map(str::to_owned).unwrap_or_default().as_str() {
            "file" => match field.bytes().await {
                Ok(bytes) => file = Some(bytes.to_vec()),
                Err(error) => return unreadable(&error),
            },
            "alternativeText" => match field.text().await {
                Ok(text) => alternative_text = Some(text),
                Err(error) => return unreadable(&error),
            },
            // Ignored rather than refused: a client sending a part this shop
            // does not read is not a client sending something wrong.
            _ => continue,
        }
    }

    let Some(file) = file else {
        return problem(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Unprocessable Entity",
            "/problems/image-missing",
            "The request carries no file part.",
        );
    };

    match images::add(
        &state.db,
        &state.storage,
        product_id,
        file,
        alternative_text,
    )
    .await
    {
        Ok(image) => {
            state.deriver.nudge();
            (StatusCode::CREATED, Json(image)).into_response()
        }
        Err(error) => refusal_response(error),
    }
}

/// Remove one image, and the files it was stored as.
#[utoipa::path(
    delete,
    path = "/api/products/{id}/images/{imageId}",
    tag = "catalogue",
    params(
        ("id" = i64, Path, description = "The product"),
        ("imageId" = i64, Path, description = "The image"),
    ),
    responses(
        (status = 204, description = "Removed"),
        (status = 401, description = "No live session", body = ApiError),
        (status = 404, description = "type: /problems/no-such-image", body = ApiError),
    ),
)]
pub async fn remove_image(
    CurrentStaff(_staff): CurrentStaff,
    State(state): State<AppState>,
    Path((product_id, image_id)): Path<(i64, i64)>,
) -> Response {
    match images::remove(&state.db, &state.storage, product_id, image_id).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => refusal_response(error),
    }
}

/// Serve one file of one image.
///
/// Public and unauthenticated: this is what a storefront page loads. The file
/// name is a size and a format the shop decided on, never anything a caller
/// composed — the reference is the only part that varies, and it is read under
/// a rule that admits thirty-two hexadecimal characters.
pub async fn serve_image(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Path((reference, file)): Path<(String, String)>,
) -> Response {
    let Some(reference) = ImageReference::parse(&reference) else {
        return ApiError::not_found().into_response();
    };

    let Some((size, format)) = file.split_once('.').and_then(|(size, extension)| {
        Some((Size::parse(size)?, Format::from_extension(extension)?))
    }) else {
        return ApiError::not_found().into_response();
    };

    let located = match images::locate(&state.db, &reference).await {
        Ok(Some(located)) => located,
        Ok(None) => return ApiError::not_found().into_response(),
        Err(error) => {
            tracing::error!("cannot look up an image: {error}");
            return ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response();
        }
    };

    let served = match images::serve(&state.storage, &located, size, format).await {
        Ok(Some(served)) => served,
        Ok(None) => return ApiError::not_found().into_response(),
        Err(error) => {
            tracing::error!("cannot read an image file: {error}");
            return ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response();
        }
    };

    let cache = if served.is_final {
        IMMUTABLE
    } else {
        WHILE_PREPARING
    };
    let tag = entity_tag(&served.bytes);

    // The stand-in served while an image is being prepared is revalidated
    // within seconds, and this is what makes that revalidation cost a header
    // rather than the whole file again.
    if headers
        .get(header::IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.split(',').any(|candidate| candidate.trim() == tag))
    {
        return (
            StatusCode::NOT_MODIFIED,
            [
                (header::CACHE_CONTROL, cache.to_owned()),
                (header::ETAG, tag),
            ],
        )
            .into_response();
    }

    (
        [
            (header::CONTENT_TYPE, served.format.media_type().to_owned()),
            (header::CACHE_CONTROL, cache.to_owned()),
            (header::ETAG, tag),
        ],
        Body::from(served.bytes),
    )
        .into_response()
}

fn refusal_response(error: ImageError) -> Response {
    match error {
        ImageError::NoSuchProduct => problem(
            StatusCode::NOT_FOUND,
            "Not Found",
            "/problems/no-such-product",
            "No product has this identifier.",
        ),
        ImageError::NoSuchImage => problem(
            StatusCode::NOT_FOUND,
            "Not Found",
            "/problems/no-such-image",
            "This product has no image with this identifier.",
        ),
        ImageError::NotJpeg => problem(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Unprocessable Entity",
            "/problems/image-not-jpeg",
            "The shop accepts JPEG only, whatever the file is named.",
        ),
        ImageError::TooSmall { long_side } => problem(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Unprocessable Entity",
            "/problems/image-too-small",
            format!(
                "The long side is {long_side} px, and the shop needs at least {} px.",
                crate::images::derive::MINIMUM_LONG_SIDE,
            ),
        ),
        ImageError::TooLarge { long_side } => problem(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Unprocessable Entity",
            "/problems/image-too-large",
            format!(
                "The long side is {long_side} px, and the shop keeps at most {} px.",
                crate::images::derive::MAXIMUM_LONG_SIDE,
            ),
        ),
        ImageError::TooHeavy { bytes } => problem(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Content Too Large",
            "/problems/image-too-heavy",
            format!("The file is {bytes} bytes, and the shop accepts at most {MAX_BYTES}."),
        ),
        ImageError::TooMany => problem(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Unprocessable Entity",
            "/problems/too-many-images",
            format!("A product carries at most {MAX_PER_PRODUCT} images."),
        ),
        ImageError::Unavailable => {
            ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error")
                .into_response()
        }
    }
}

/// A body the multipart reader would not take: over the size limit, or simply
/// malformed. The reader is the layer that meets both first, and it already
/// tells them apart by status — so the shop keeps its status rather than
/// calling every unreadable upload too heavy.
fn unreadable(error: &axum::extract::multipart::MultipartError) -> Response {
    tracing::info!("an upload could not be read: {error}");

    if error.status() == StatusCode::PAYLOAD_TOO_LARGE {
        return problem(
            StatusCode::PAYLOAD_TOO_LARGE,
            "Content Too Large",
            "/problems/image-too-heavy",
            format!("The shop accepts at most {MAX_BYTES} bytes per file."),
        );
    }

    problem(
        StatusCode::BAD_REQUEST,
        "Bad Request",
        "/problems/malformed-upload",
        "The multipart body could not be read.",
    )
}

/// A problem the interface tells apart by its `type`, since `title` and
/// `detail` are diagnostic text and are never shown to a user
/// (`docs/backend/adr/0003-problem-details-errors.md`).
fn problem(
    status: StatusCode,
    title: &'static str,
    kind: &'static str,
    detail: impl Into<String>,
) -> Response {
    ApiError::new(status, title)
        .with_kind(kind)
        .with_detail(detail)
        .into_response()
}
