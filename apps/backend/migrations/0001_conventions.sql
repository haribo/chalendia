-- Conventions every later migration follows.
--
--   Names          snake_case; tables plural, columns singular.
--   Keys           bigint generated always as identity. Public references that
--                  must not be guessable are their own column, never the key.
--   Time           timestamptz, always UTC. Never a bare timestamp.
--   Money          bigint minor units of the shop currency. Never float, never
--                  numeric-with-scale-per-column.
--   Audit columns  created_at and updated_at on every mutable table, the latter
--                  maintained by the trigger below, never by application code.
--   Direction      forward only. A mistake is corrected by a new migration.

-- Keeps updated_at honest: a row cannot be modified without its timestamp
-- moving, whatever wrote it — application, migration, or a human at psql.
create function set_updated_at() returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

comment on function set_updated_at() is
    'BEFORE UPDATE trigger: stamps updated_at with the transaction time.';
