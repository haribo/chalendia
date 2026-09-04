//! The photographs a product is shown with.
//!
//! An upload validates the file, keeps it as the source, records the image as
//! pending and answers. The sizes the shop serves are derived behind that,
//! one image at a time, and the shop serves the source until they exist
//! (`docs/design/catalog.md` § 5, `docs/backend/adr/0008-image-pipeline.md`).

pub mod derive;

use std::sync::Arc;

use serde::Serialize;
use sqlx::PgPool;
use tokio::sync::Notify;
use utoipa::ToSchema;

use crate::storage::{Format, ImageReference, Size, Storage, Stored};
use crate::validation::optional;

/// Refused above this, by the shop and not only by the browser: without a
/// limit here, one photo library fills the disk and the shop stops
/// (`docs/design/catalog.md` § 5).
pub const MAX_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_PER_PRODUCT: i64 = 10;

/// How long the deriver waits before looking again when nothing woke it.
const RETRY_AFTER: std::time::Duration = std::time::Duration::from_secs(60);

/// How far a derived size has got.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ImageState {
    /// Stored and readable; the sizes the shop serves do not exist yet, and the
    /// source stands in for them.
    Pending,
    Ready,
    /// The derivation failed. The image is still readable from its source, and
    /// the back office says so rather than showing a gap forever.
    Failed,
}

impl ImageState {
    fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Ready => "ready",
            Self::Failed => "failed",
        }
    }

    fn from_str(value: &str) -> Self {
        match value {
            "ready" => Self::Ready,
            "failed" => Self::Failed,
            _ => Self::Pending,
        }
    }
}

/// One image, as the back office reads it.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductImage {
    pub id: i64,
    /// The varying part of every URL this image is served at.
    pub reference: String,
    /// Ascending, first shown first.
    pub position: i32,
    /// Absent is a flag in the back office, not a refusal at upload
    /// (`docs/design/catalog.md` § 5).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternative_text: Option<String>,
    pub state: ImageState,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ImageError {
    NoSuchProduct,
    NoSuchImage,
    NotJpeg,
    TooSmall {
        long_side: u32,
    },
    TooLarge {
        long_side: u32,
    },
    TooHeavy {
        bytes: usize,
    },
    TooMany,
    /// The order sent is not exactly the product's images.
    NotTheSameImages,
    Unavailable,
}

impl From<sqlx::Error> for ImageError {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!("image storage failed: {error}");
        Self::Unavailable
    }
}

impl From<std::io::Error> for ImageError {
    fn from(error: std::io::Error) -> Self {
        tracing::error!("cannot write an image file: {error}");
        Self::Unavailable
    }
}

/// Stores one uploaded photograph and records it as pending.
///
/// The file is written before the row is committed. A crash between the two
/// leaves a file no row points at — unreachable, since its reference exists
/// nowhere else — where the reverse order would leave a row pointing at
/// nothing, which every reader would have to defend against.
pub async fn add(
    pool: &PgPool,
    storage: &Storage,
    product_id: i64,
    bytes: Vec<u8>,
    alternative_text: Option<String>,
) -> Result<ProductImage, ImageError> {
    if bytes.len() > MAX_BYTES {
        return Err(ImageError::TooHeavy { bytes: bytes.len() });
    }

    let dimensions = derive::inspect(&bytes).map_err(|problem| match problem {
        derive::SourceProblem::NotJpeg => ImageError::NotJpeg,
        derive::SourceProblem::TooSmall { long_side } => ImageError::TooSmall { long_side },
        derive::SourceProblem::TooLarge { long_side } => ImageError::TooLarge { long_side },
    })?;

    let mut transaction = pool.begin().await?;

    // Locks the product for the length of the transaction, so two uploads
    // racing cannot both read nine images and both write the tenth.
    let product = sqlx::query_scalar!(
        "select id from products where id = $1 for update",
        product_id
    )
    .fetch_optional(&mut *transaction)
    .await?;
    if product.is_none() {
        return Err(ImageError::NoSuchProduct);
    }

    let held = sqlx::query_scalar!(
        "select count(*) from product_images where product_id = $1",
        product_id
    )
    .fetch_one(&mut *transaction)
    .await?
    .unwrap_or(0);
    if held >= MAX_PER_PRODUCT {
        return Err(ImageError::TooMany);
    }

    let reference = ImageReference::generate();
    let alternative_text = optional(alternative_text.as_deref());
    // Bounded by the inspection above, so the fallback is unreachable rather
    // than a silent truncation of anything a caller can send.
    let width = i32::try_from(dimensions.width).unwrap_or(i32::MAX);
    let height = i32::try_from(dimensions.height).unwrap_or(i32::MAX);

    let record = sqlx::query!(
        "insert into product_images \
           (product_id, reference, position, alternative_text, state, source_width, source_height) \
         values \
           ($1, $2, coalesce((select max(position) + 1 from product_images where product_id = $1), 0), \
            $3, $6, $4, $5) \
         returning id, position",
        product_id,
        reference.as_str(),
        alternative_text,
        width,
        height,
        ImageState::Pending.as_str(),
    )
    .fetch_one(&mut *transaction)
    .await?;

    storage.write(&reference, Stored::Source, bytes).await?;

    transaction.commit().await?;

    Ok(ProductImage {
        id: record.id,
        reference: reference.as_str().to_owned(),
        position: record.position,
        alternative_text,
        state: ImageState::Pending,
        width,
        height,
    })
}

/// A product's images, in the order they are shown.
pub async fn list(pool: &PgPool, product_id: i64) -> Result<Vec<ProductImage>, sqlx::Error> {
    let rows = sqlx::query!(
        "select id, reference, position, alternative_text, state, source_width, source_height \
         from product_images \
         where product_id = $1 \
         order by position, id",
        product_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| ProductImage {
            id: row.id,
            reference: row.reference,
            position: row.position,
            alternative_text: row.alternative_text,
            state: ImageState::from_str(&row.state),
            width: row.source_width,
            height: row.source_height,
        })
        .collect())
}

/// Removes one image, row and files together.
///
/// The row goes first: a file left behind is disk nobody reads, while a row
/// left behind is a broken picture on the storefront.
pub async fn remove(
    pool: &PgPool,
    storage: &Storage,
    product_id: i64,
    image_id: i64,
) -> Result<(), ImageError> {
    let removed = sqlx::query!(
        "delete from product_images where id = $1 and product_id = $2 returning reference",
        image_id,
        product_id
    )
    .fetch_optional(pool)
    .await?;

    let Some(removed) = removed else {
        return Err(ImageError::NoSuchImage);
    };

    if let Some(reference) = ImageReference::parse(&removed.reference) {
        storage.remove(&reference).await?;
    }

    Ok(())
}

/// Puts a product's images in the order the caller asks for.
///
/// The **whole list**, never a move. A list says what the order is to be; a
/// "move this one up" says what it is to become from an order the caller read
/// a moment ago and that may have changed since.
///
/// The list must be exactly the product's images — none missing, none extra,
/// none repeated, none belonging elsewhere. Without that rule a client holding
/// a stale page silently reorders images it has never seen, and the merchant
/// finds a storefront ordered by a screen nobody was looking at.
pub async fn reorder(
    pool: &PgPool,
    product_id: i64,
    wanted: &[i64],
) -> Result<Vec<ProductImage>, ImageError> {
    let mut transaction = pool.begin().await?;

    // Locked as the upload locks it, so an image cannot be added or removed
    // between the check below and the write that trusts it.
    let product = sqlx::query_scalar!(
        "select id from products where id = $1 for update",
        product_id
    )
    .fetch_optional(&mut *transaction)
    .await?;
    if product.is_none() {
        return Err(ImageError::NoSuchProduct);
    }

    let held: Vec<i64> = sqlx::query_scalar!(
        "select id from product_images where product_id = $1",
        product_id
    )
    .fetch_all(&mut *transaction)
    .await?;

    if !is_the_same_set(&held, wanted) {
        return Err(ImageError::NotTheSameImages);
    }

    // One statement over the whole list. `(product_id, position)` carries no
    // unique index precisely so this can pass through an intermediate state
    // where two rows share a position — see `0006_product_images.sql`.
    let positions: Vec<i32> = (0..wanted.len())
        .map(|index| i32::try_from(index).unwrap_or(i32::MAX))
        .collect();

    sqlx::query!(
        "update product_images as image \
         set position = ordering.position \
         from unnest($1::bigint[], $2::int[]) as ordering (id, position) \
         where image.id = ordering.id and image.product_id = $3",
        wanted,
        &positions,
        product_id,
    )
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;

    Ok(list(pool, product_id).await?)
}

/// The same images, in any order, each exactly once.
///
/// Sorted copies rather than sets: the duplicate that a set would swallow is
/// one of the things being refused.
fn is_the_same_set(held: &[i64], wanted: &[i64]) -> bool {
    if held.len() != wanted.len() {
        return false;
    }

    let mut held: Vec<i64> = held.to_vec();
    let mut wanted: Vec<i64> = wanted.to_vec();
    held.sort_unstable();
    wanted.sort_unstable();

    held == wanted
}

/// What a request for one file needs to know: whether the image exists, and
/// whether its derived sizes are there yet.
pub struct Located {
    pub reference: ImageReference,
    pub state: ImageState,
}

pub async fn locate(
    pool: &PgPool,
    reference: &ImageReference,
) -> Result<Option<Located>, sqlx::Error> {
    let row = sqlx::query!(
        "select state from product_images where reference = $1",
        reference.as_str()
    )
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|row| Located {
        reference: reference.clone(),
        state: ImageState::from_str(&row.state),
    }))
}

/// Reads one file, falling back to the source when the asked-for size is not
/// derived yet.
///
/// The source has no URL of its own: it is substituted here, so a page written
/// against the served sizes shows a heavy but correct picture during the two
/// seconds the encoding takes, rather than a hole.
pub struct Served {
    pub bytes: Vec<u8>,
    pub format: Format,
    /// True once what was asked for is what is returned, which is when a year
    /// of caching is safe: a derived file never changes, since a new upload is
    /// a new reference.
    pub is_final: bool,
}

pub async fn serve(
    storage: &Storage,
    located: &Located,
    size: Size,
    format: Format,
) -> Result<Option<Served>, std::io::Error> {
    if located.state == ImageState::Ready
        && let Some(bytes) = storage
            .read(&located.reference, Stored::Derived(size, format))
            .await?
    {
        return Ok(Some(Served {
            bytes,
            format,
            is_final: true,
        }));
    }

    Ok(storage
        .read(&located.reference, Stored::Source)
        .await?
        .map(|bytes| Served {
            bytes,
            format: Format::Jpeg,
            is_final: false,
        }))
}

/// Derives the sizes of the oldest image still waiting for them, if there is
/// one. Returns whether it did any work.
///
/// One image per call, and one caller: the shop runs this from a single task,
/// so an upload burst never takes every core away from serving requests
/// (`docs/backend/adr/0008-image-pipeline.md`).
pub async fn derive_next_pending(pool: &PgPool, storage: &Storage) -> bool {
    // The literal rather than a parameter: `product_images_pending` is a
    // partial index on exactly this predicate, and a planner cannot match a
    // partial index against a value it will only see at execution time.
    let waiting = sqlx::query!(
        "select id, reference from product_images \
         where state = 'pending' \
         order by created_at, id \
         limit 1",
    )
    .fetch_optional(pool)
    .await;

    let waiting = match waiting {
        Ok(Some(row)) => row,
        Ok(None) => return false,
        Err(error) => {
            tracing::error!("cannot look for images to prepare: {error}");
            return false;
        }
    };

    let Some(reference) = ImageReference::parse(&waiting.reference) else {
        // The shop wrote this reference itself, so this cannot happen without
        // the row having been edited by hand. Failing it is better than
        // reading it every second forever.
        record_failure(pool, waiting.id, "the stored reference is malformed").await;
        return true;
    };

    let source = match storage.read(&reference, Stored::Source).await {
        Ok(Some(source)) => source,
        Ok(None) => {
            record_failure(pool, waiting.id, "the source file is missing").await;
            return true;
        }
        Err(error) => {
            tracing::error!("cannot read the source of image {}: {error}", waiting.id);
            return false;
        }
    };

    // Encoding is seconds of processor work, which would otherwise hold the
    // runtime's worker thread and every request queued behind it.
    let derived = match tokio::task::spawn_blocking(move || derive::derive(&source)).await {
        Ok(Ok(renditions)) => renditions,
        Ok(Err(reason)) => {
            record_failure(pool, waiting.id, &reason).await;
            return true;
        }
        Err(error) => {
            tracing::error!("the derivation task did not finish: {error}");
            return false;
        }
    };

    for rendition in derived {
        if let Err(error) = storage
            .write(
                &reference,
                Stored::Derived(rendition.size, rendition.format),
                rendition.bytes,
            )
            .await
        {
            tracing::error!("cannot write a derived file: {error}");
            record_failure(pool, waiting.id, "a derived file could not be written").await;
            return true;
        }
    }

    // Last: until this row says ready, every request is served the source, and
    // a crash anywhere above leaves the image pending — which the next start
    // takes up again.
    if let Err(error) = sqlx::query!(
        "update product_images set state = $2, failure = null where id = $1",
        waiting.id,
        ImageState::Ready.as_str(),
    )
    .execute(pool)
    .await
    {
        tracing::error!("cannot record image {} as ready: {error}", waiting.id);
    }

    true
}

async fn record_failure(pool: &PgPool, id: i64, reason: &str) {
    tracing::error!("cannot prepare image {id}: {reason}");

    if let Err(error) = sqlx::query!(
        "update product_images set state = $2, failure = $3 where id = $1",
        id,
        ImageState::Failed.as_str(),
        reason,
    )
    .execute(pool)
    .await
    {
        tracing::error!("cannot record image {id} as failed: {error}");
    }
}

/// The handle an upload wakes the preparing task with.
///
/// Separate from the task itself so that what a request touches is a
/// notification and nothing else: whoever runs the loop owns the pool and the
/// storage, and a caller cannot start a second one by accident.
#[derive(Clone, Default)]
pub struct Deriver {
    wake: Arc<Notify>,
}

impl Deriver {
    /// Prepares images until the process ends, one at a time.
    ///
    /// Looks for pending images before waiting for anything, which is how a
    /// restart in the middle of an encoding is taken up: the state is in the
    /// database, so there is no separate resume path to get wrong
    /// (`docs/backend/adr/0008-image-pipeline.md`).
    pub async fn run(self, pool: PgPool, storage: Storage) {
        loop {
            while derive_next_pending(&pool, &storage).await {}

            // Woken by an upload, and on a timer regardless: a database that
            // was briefly unreachable must not leave an image pending until
            // the next merchant happens to upload one.
            let _ = tokio::time::timeout(RETRY_AFTER, self.wake.notified()).await;
        }
    }

    /// Tells the task an image is waiting. Never blocks, and a notification
    /// that arrives while it is already working is not lost: the loop drains
    /// everything pending before waiting again.
    pub fn nudge(&self) {
        self.wake.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_order_holding_the_same_images_is_accepted() {
        assert!(is_the_same_set(&[1, 2, 3], &[3, 1, 2]));
        assert!(is_the_same_set(&[], &[]));
    }

    #[test]
    fn an_order_that_is_not_the_same_images_is_refused() {
        // Missing, extra, foreign, and repeated — the repeated one is why this
        // compares sorted lists rather than sets.
        assert!(!is_the_same_set(&[1, 2, 3], &[1, 2]));
        assert!(!is_the_same_set(&[1, 2], &[1, 2, 3]));
        assert!(!is_the_same_set(&[1, 2, 3], &[1, 2, 9]));
        assert!(!is_the_same_set(&[1, 2, 3], &[1, 2, 2]));
    }

    #[test]
    fn a_state_survives_the_round_trip_through_the_database_value() {
        for state in [ImageState::Pending, ImageState::Ready, ImageState::Failed] {
            assert_eq!(ImageState::from_str(state.as_str()), state);
        }
    }

    #[test]
    fn an_unknown_state_reads_as_pending() {
        // Pending is the safe reading: the shop serves the source and tries to
        // derive again, where reading it as ready would serve nothing.
        assert_eq!(ImageState::from_str("whatever"), ImageState::Pending);
    }
}
