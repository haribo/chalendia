//! Products, their variants, and the listing staff manage them from.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;

use crate::validation::{FieldProblem, optional, required};

/// Where a product stands (`docs/design/catalog.md` § 1, Publication states).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ProductState {
    Draft,
    Published,
    Retired,
}

impl ProductState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Published => "published",
            Self::Retired => "retired",
        }
    }

    fn from_str(value: &str) -> Self {
        match value {
            "published" => Self::Published,
            "retired" => Self::Retired,
            _ => Self::Draft,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NewProduct {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Inclusive of tax, in minor units of the shop currency
    /// (`docs/design/core.md` § 5, § 6).
    pub price: i64,
    #[serde(default)]
    pub merchant_reference: Option<String>,
    /// Draft unless staff publish from the same form. Absent means draft.
    #[serde(default)]
    pub state: Option<ProductState>,
}

/// A row of the back-office listing (`docs/design/catalog.md` § 7).
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductSummary {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub state: ProductState,
    pub price: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merchant_reference: Option<String>,
}

/// One page of a listing, and enough to say where it sits in the whole.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductPage {
    pub items: Vec<ProductSummary>,
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
}

#[derive(Debug)]
pub enum CatalogueError {
    Invalid(Vec<FieldProblem>),
    Unavailable,
}

/// Page sizes the listing accepts. A caller asking for everything gets the
/// maximum, never the whole table (`docs/design/core.md` § 8, Lists).
pub const DEFAULT_PAGE_SIZE: i64 = 20;
pub const MAX_PAGE_SIZE: i64 = 100;

/// The public address a product is reachable at.
///
/// Deliberately narrow: the ASCII letters and digits of the title, accented
/// Latin letters folded to the letter they are built on, everything else a
/// separator. A title in a script this cannot transcribe leaves nothing, and
/// the caller falls back to the identifier rather than inventing an address.
pub fn slugify(title: &str) -> String {
    let mut slug = String::with_capacity(title.len());
    let mut pending_dash = false;

    for character in title.chars().flat_map(fold) {
        if character.is_ascii_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            pending_dash = false;
            slug.push(character.to_ascii_lowercase());
        } else {
            pending_dash = true;
        }
    }

    slug
}

/// Folds one character to the ASCII it is built on, when it is built on one.
fn fold(character: char) -> impl Iterator<Item = char> {
    let folded: &str = match character {
        'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'À' | 'Á' | 'Â' | 'Ã' | 'Ä' | 'Å' => "a",
        'ç' | 'Ç' => "c",
        'è' | 'é' | 'ê' | 'ë' | 'È' | 'É' | 'Ê' | 'Ë' => "e",
        'ì' | 'í' | 'î' | 'ï' | 'Ì' | 'Í' | 'Î' | 'Ï' => "i",
        'ñ' | 'Ñ' => "n",
        'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'Ò' | 'Ó' | 'Ô' | 'Õ' | 'Ö' => "o",
        'ù' | 'ú' | 'û' | 'ü' | 'Ù' | 'Ú' | 'Û' | 'Ü' => "u",
        'ý' | 'ÿ' | 'Ý' => "y",
        'æ' | 'Æ' => "ae",
        'œ' | 'Œ' => "oe",
        'ß' => "ss",
        _ => return Left(std::iter::once(character)),
    };

    Right(folded.chars())
}

// A tiny either, so `fold` can return one character or several without an
// allocation per character.
enum Either<L, R> {
    Left(L),
    Right(R),
}
use Either::{Left, Right};

impl<L: Iterator<Item = char>, R: Iterator<Item = char>> Iterator for Either<L, R> {
    type Item = char;

    fn next(&mut self) -> Option<char> {
        match self {
            Left(left) => left.next(),
            Right(right) => right.next(),
        }
    }
}

/// Creates a product and the single variant carrying its price.
///
/// One transaction: the design has no such thing as a product without a
/// variant, so a half-written one must not survive a failure.
pub async fn create(pool: &PgPool, request: NewProduct) -> Result<i64, CatalogueError> {
    let mut problems = Vec::new();

    let title = required(&request.title, "title", &mut problems);
    let description = optional(request.description.as_deref());
    let merchant_reference = optional(request.merchant_reference.as_deref());

    if request.price < 0 {
        // The sign is the whole problem, and it is visible in the value.
        problems.push(FieldProblem::blank("price"));
    }

    let state = match request.state {
        None => ProductState::Draft,
        Some(ProductState::Retired) => {
            problems.push(FieldProblem::saying(
                "state",
                "A product cannot be created retired.",
            ));
            ProductState::Draft
        }
        Some(state) => state,
    };

    if !problems.is_empty() {
        return Err(CatalogueError::Invalid(problems));
    }

    let mut transaction = pool
        .begin()
        .await
        .map_err(|_| CatalogueError::Unavailable)?;

    // The address is unique, and two products may well be named the same. The
    // suffix is tried against the database rather than guessed from a count,
    // because a count races with whoever is saving at the same moment.
    let base = slugify(&title);
    let mut product = None;
    for attempt in 1..=50 {
        let slug = match (base.as_str(), attempt) {
            ("", _) => format!("product-{attempt}"),
            (base, 1) => base.to_owned(),
            (base, attempt) => format!("{base}-{attempt}"),
        };

        let inserted = sqlx::query!(
            "insert into products (title, description, slug, state)
             values ($1, $2, $3, $4)
             on conflict (slug) do nothing
             returning id",
            title,
            description,
            slug,
            state.as_str(),
        )
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| CatalogueError::Unavailable)?;

        if let Some(row) = inserted {
            product = Some(row.id);
            break;
        }
    }

    let product = product.ok_or(CatalogueError::Unavailable)?;

    sqlx::query!(
        "insert into variants (product_id, price, merchant_reference) values ($1, $2, $3)",
        product,
        request.price,
        merchant_reference,
    )
    .execute(&mut *transaction)
    .await
    .map_err(|_| CatalogueError::Unavailable)?;

    transaction
        .commit()
        .await
        .map_err(|_| CatalogueError::Unavailable)?;

    Ok(product)
}

/// One page of the back-office listing, most recently created first.
pub async fn list(pool: &PgPool, page: i64, page_size: i64) -> Result<ProductPage, sqlx::Error> {
    let page = page.max(1);
    let page_size = page_size.clamp(1, MAX_PAGE_SIZE);
    let offset = (page - 1) * page_size;

    let rows = sqlx::query!(
        "select p.id, p.title, p.slug, p.state, v.price, v.merchant_reference
         from products p
         join lateral (
             select price, merchant_reference
             from variants
             where product_id = p.id
             order by id
             limit 1
         ) v on true
         order by p.created_at desc, p.id desc
         limit $1 offset $2",
        page_size,
        offset,
    )
    .fetch_all(pool)
    .await?;

    let total = sqlx::query!("select count(*) as \"count!\" from products")
        .fetch_one(pool)
        .await?
        .count;

    Ok(ProductPage {
        items: rows
            .into_iter()
            .map(|row| ProductSummary {
                id: row.id,
                title: row.title,
                slug: row.slug,
                state: ProductState::from_str(&row.state),
                price: row.price,
                merchant_reference: row.merchant_reference,
            })
            .collect(),
        page,
        page_size,
        total,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_address_is_the_title_in_ascii_lowercase() {
        assert_eq!(slugify("Savon de Marseille"), "savon-de-marseille");
    }

    #[test]
    fn accents_fold_to_the_letter_they_are_built_on() {
        // The apostrophe separates like any other punctuation, which reads
        // better than gluing the article to the word: l-oeillet, not loeillet.
        assert_eq!(slugify("Crème à l'Œillet"), "creme-a-l-oeillet");
    }

    #[test]
    fn punctuation_and_repeats_collapse_into_single_dashes() {
        assert_eq!(slugify("  Savon  --  100% olive !! "), "savon-100-olive");
    }

    #[test]
    fn a_title_with_nothing_transcribable_leaves_nothing() {
        assert_eq!(slugify("石鹸"), "");
    }
}
