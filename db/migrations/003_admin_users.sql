-- Admin accounts: real users with their own passwords, a second factor by
-- email, and sessions that can be revoked one at a time.
--
-- Until now the dashboard had no notion of a person. One password lived in an
-- environment variable, the session cookie carried nothing but an expiry, and
-- so there was no way to tell two administrators apart, no way to remove one
-- without changing the password for everyone, and no way to end a single
-- session. This is the table set that fixes that.
--
-- Additive only, and every statement is safe to run twice.

create extension if not exists "pgcrypto";

-- A person who can sign in to the dashboard.
--
-- password_hash is null between the invitation being sent and the invitee
-- choosing a password, which is deliberate: an invited-but-not-accepted account
-- cannot be signed in to, and does not count towards the bootstrap check that
-- decides whether the old shared password still works.
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text        not null,
  name          text        not null,
  password_hash text,
  -- owner: may manage other administrators. member: may not.
  role          text        not null default 'member',
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  disabled_at   timestamptz
);

create unique index if not exists admin_users_email_key on admin_users (lower(email));

-- One signed-in browser. Rows rather than a self-contained token so a session
-- can be ended from the other side: revoking is what you need when a laptop is
-- lost, and a stateless token cannot be taken back.
create table if not exists admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references admin_users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  user_agent   text
);

create index if not exists admin_sessions_user_idx on admin_sessions (user_id, created_at desc);

-- The second factor. A short-lived six-digit code, stored as an HMAC rather
-- than as itself: six digits is a million guesses, which is nothing offline, so
-- a copy of this table must not hand anyone a working code.
create table if not exists admin_login_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references admin_users (id) on delete cascade,
  code_hash   text        not null,
  attempts    integer     not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists admin_login_codes_user_idx on admin_login_codes (user_id);

-- An unaccepted invitation. The token is stored hashed for the same reason as
-- the code: it is a credential until it is used.
create table if not exists admin_invites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references admin_users (id) on delete cascade,
  token_hash  text        not null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create unique index if not exists admin_invites_token_key on admin_invites (token_hash);
create index if not exists admin_invites_user_idx on admin_invites (user_id);
