-- The rates a shop may charge, and which one a product carries.
--
-- The rates are the merchant's own, for the merchant's own country
-- (docs/design/core.md § 6). Destination-based rates are out of v1, and this
-- shape is what they would later hang off rather than replace.

create table vat_rates (
    id         bigint generated always as identity primary key,
    -- "Standard", "Réduit": what a merchant looks for in a list. A percentage
    -- alone is not a name.
    name       text        not null,
    -- Basis points, so 20 % is 2000 and 5.5 % is 550: the same reason money is
    -- held in minor units, since a rate multiplies an amount.
    basis_points integer   not null check (basis_points >= 0 and basis_points <= 10000),
    is_default boolean     not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index vat_rates_name on vat_rates (name);

-- One default at most, held by the schema rather than by whoever writes next.
create unique index vat_rates_single_default on vat_rates (is_default) where is_default;

create trigger vat_rates_set_updated_at
    before update on vat_rates
    for each row execute function set_updated_at();

-- A product points at the rate, never at the number: correcting a rate that
-- changed by law moves every product carrying it (docs/design/core.md § 6).
-- Restricted rather than cascading: deleting a rate in use is refused, with the
-- products that hold it.
alter table products
    add column vat_rate_id bigint references vat_rates (id) on delete restrict;

create index products_vat_rate on products (vat_rate_id);

comment on column products.vat_rate_id is
    'Null means the shop default applies (docs/design/core.md § 6).';
