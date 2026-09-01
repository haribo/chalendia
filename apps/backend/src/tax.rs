//! The rates a shop charges, and the one a product carries.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;

use crate::validation::{FieldProblem, required};

/// Rates are held in basis points — 20 % is 2000, 5.5 % is 550 — for the same
/// reason money is held in minor units: a rate multiplies an amount, and a
/// float in that path is a cent lost somewhere nobody looks.
pub const BASIS_POINTS_PER_UNIT: i32 = 10_000;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VatRate {
    pub id: i64,
    pub name: String,
    pub basis_points: i32,
    pub is_default: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NewVatRate {
    pub name: String,
    pub basis_points: Option<i32>,
    /// Absent means the first rate is the default and the others are not.
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug)]
pub enum TaxError {
    Invalid(Vec<FieldProblem>),
    /// Refused because products carry it, with how many.
    InUse {
        products: i64,
    },
    Unknown,
    Unavailable,
}

pub async fn list(pool: &PgPool) -> Result<Vec<VatRate>, sqlx::Error> {
    let rows = sqlx::query!(
        "select id, name, basis_points, is_default from vat_rates order by basis_points desc, id"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| VatRate {
            id: row.id,
            name: row.name,
            basis_points: row.basis_points,
            is_default: row.is_default,
        })
        .collect())
}

/// Adds a rate. The first one is the default whatever was asked: a shop with
/// rates and no default has products pointing at nothing.
pub async fn create(pool: &PgPool, request: NewVatRate) -> Result<i64, TaxError> {
    let mut problems = Vec::new();

    let name = required(&request.name, "name", &mut problems);

    let basis_points = match request.basis_points {
        Some(value) if (0..=BASIS_POINTS_PER_UNIT).contains(&value) => value,
        _ => {
            // Missing, negative or beyond 100 %: each shows its own problem.
            problems.push(FieldProblem::blank("basisPoints"));
            0
        }
    };

    if !problems.is_empty() {
        return Err(TaxError::Invalid(problems));
    }

    let mut transaction = pool.begin().await.map_err(|_| TaxError::Unavailable)?;

    let first = sqlx::query!("select count(*) as \"count!\" from vat_rates")
        .fetch_one(&mut *transaction)
        .await
        .map_err(|_| TaxError::Unavailable)?
        .count
        == 0;
    let is_default = first || request.is_default;

    if is_default {
        sqlx::query!("update vat_rates set is_default = false where is_default")
            .execute(&mut *transaction)
            .await
            .map_err(|_| TaxError::Unavailable)?;
    }

    let inserted = sqlx::query!(
        "insert into vat_rates (name, basis_points, is_default)
         values ($1, $2, $3)
         on conflict (name) do nothing
         returning id",
        name,
        basis_points,
        is_default,
    )
    .fetch_optional(&mut *transaction)
    .await
    .map_err(|_| TaxError::Unavailable)?;

    let Some(row) = inserted else {
        // Two rates with one name is two rates nobody can tell apart.
        return Err(TaxError::Invalid(vec![FieldProblem::saying(
            "name",
            "A rate already has this name.",
        )]));
    };

    transaction
        .commit()
        .await
        .map_err(|_| TaxError::Unavailable)?;

    Ok(row.id)
}

/// Removes a rate, unless products carry it.
pub async fn remove(pool: &PgPool, id: i64) -> Result<(), TaxError> {
    let products = sqlx::query!(
        "select count(*) as \"count!\" from products where vat_rate_id = $1",
        id
    )
    .fetch_one(pool)
    .await
    .map_err(|_| TaxError::Unavailable)?
    .count;

    if products > 0 {
        return Err(TaxError::InUse { products });
    }

    let deleted = sqlx::query!("delete from vat_rates where id = $1", id)
        .execute(pool)
        .await
        .map_err(|_| TaxError::Unavailable)?;

    if deleted.rows_affected() == 0 {
        return Err(TaxError::Unknown);
    }

    Ok(())
}

/// Moves the default to another rate. One at most, held by the schema.
pub async fn set_default(pool: &PgPool, id: i64) -> Result<(), TaxError> {
    let mut transaction = pool.begin().await.map_err(|_| TaxError::Unavailable)?;

    sqlx::query!("update vat_rates set is_default = false where is_default")
        .execute(&mut *transaction)
        .await
        .map_err(|_| TaxError::Unavailable)?;

    let updated = sqlx::query!("update vat_rates set is_default = true where id = $1", id)
        .execute(&mut *transaction)
        .await
        .map_err(|_| TaxError::Unavailable)?;

    if updated.rows_affected() == 0 {
        return Err(TaxError::Unknown);
    }

    transaction
        .commit()
        .await
        .map_err(|_| TaxError::Unavailable)?;

    Ok(())
}
