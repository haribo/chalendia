-- The catalogue: what the merchant describes, and what a customer buys.

-- A product is what the customer sees; a variant is what they buy
-- (docs/design/catalog.md § 1). A product with no attributes has exactly one
-- variant, invisible as a choice — which is every product until attributes
-- land.
create table products (
    id          bigint generated always as identity primary key,
    title       text        not null,
    description text,
    -- The public address, derived from the title and unique. Its own column
    -- rather than a computed value: renaming a product must not silently move
    -- the address it was given out under (docs/design/storefront.md).
    slug        text        not null,
    state       text        not null check (state in ('draft', 'published', 'retired')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index products_slug on products (slug);

-- The back office lists most recently created first, with the identifier
-- breaking ties, so paging cannot repeat or skip a row
-- (docs/design/catalog.md § 7).
create index products_listing on products (created_at desc, id desc);

create trigger products_set_updated_at
    before update on products
    for each row execute function set_updated_at();

-- Price and merchant reference belong to the variant, not the product: two
-- sizes of one soap are two prices. Every product has at least one, created in
-- the same transaction as the product — an invariant the application holds,
-- since a deferred constraint would only move the failure, not prevent it.
create table variants (
    id                 bigint      generated always as identity primary key,
    product_id         bigint      not null references products (id) on delete cascade,
    price              bigint      not null check (price >= 0),
    merchant_reference text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index variants_product on variants (product_id);

create trigger variants_set_updated_at
    before update on variants
    for each row execute function set_updated_at();
