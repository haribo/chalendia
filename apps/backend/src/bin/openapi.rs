//! Prints the API contract. `just api-generate` writes it to `api/openapi.json`,
//! and CI fails when the committed copy differs from what this prints.

fn main() {
    println!("{}", chalendia_backend::api::document());
}
