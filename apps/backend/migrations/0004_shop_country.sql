-- Where the shop is established (docs/design/core.md § 4).
--
-- It decides which VAT rates the merchant may charge and what the legal
-- identity has to carry, so it is asked at installation from then on.

-- Nullable on purpose. An installation created before this migration has a
-- country nobody recorded, and guessing one would quietly tell a Belgian shop
-- it is French — in the one column its tax rates hang off. Absent is the truth;
-- the interface asks for it rather than inventing it.
alter table shops add column country text;

comment on column shops.country is
    'ISO 3166-1 alpha-2. Null only for installations predating this column.';
