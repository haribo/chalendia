fn main() {
    // Migrations are embedded in the binary at compile time. Without this,
    // adding or editing one leaves the previous set compiled in, and the change
    // silently does not ship.
    println!("cargo:rerun-if-changed=migrations");
}
