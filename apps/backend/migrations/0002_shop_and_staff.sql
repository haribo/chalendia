-- The shop's own identity, its staff, and the sessions proving who is asking.

-- One installation is one shop (docs/design/core.md § 1), so this table holds
-- exactly one row. The singleton index makes that an invariant of the schema
-- rather than a rule the application is trusted to remember.
create table shops (
    id                bigint generated always as identity primary key,
    name              text        not null,
    legal_identity    text        not null,
    currency          text        not null,
    content_language  text        not null,
    timezone          text        not null,
    vat_enabled       boolean     not null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create unique index shops_singleton on shops ((true));

create trigger shops_set_updated_at
    before update on shops
    for each row execute function set_updated_at();

create table staff_accounts (
    id            bigint generated always as identity primary key,
    email         text        not null,
    -- The Argon2 PHC string: algorithm, parameters and salt travel with the
    -- digest, so a later reader knows what produced it (backend ADR 0005).
    password_hash text        not null,
    role          text        not null check (role in ('administrator', 'operator')),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Email is the login identifier, normalized to lowercase before it reaches
-- here (docs/design/core.md § 3), so uniqueness is plain.
create unique index staff_accounts_email on staff_accounts (email);

create trigger staff_accounts_set_updated_at
    before update on staff_accounts
    for each row execute function set_updated_at();

create table sessions (
    id               bigint generated always as identity primary key,
    -- The hash, never the token: a copy of this table yields no usable session,
    -- for the same reason passwords are hashed.
    token_hash       bytea       not null,
    staff_account_id bigint      not null references staff_accounts (id) on delete cascade,
    expires_at       timestamptz not null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create unique index sessions_token_hash on sessions (token_hash);
create index sessions_staff_account on sessions (staff_account_id);

create trigger sessions_set_updated_at
    before update on sessions
    for each row execute function set_updated_at();
