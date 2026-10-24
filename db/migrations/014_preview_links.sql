-- Shareable preview links for drafts.
--
-- The practitioner wants to show a draft to someone who has no dashboard
-- account — a supervisor reading a page before it goes live, say. A link they
-- can open without signing in is the whole point, so the link itself is the
-- credential, and is treated like one:
--
--   - Only a SHA-256 of the token is stored. Someone who can read this table —
--     a leaked backup, a support session — learns which drafts were shared and
--     when, but cannot open any of them.
--   - Every link expires, and can be revoked before then.
--   - The link names the post or page by id, not slug, so renaming a draft
--     does not break a link that was already sent.
--
-- target_id is not a foreign key because it points at one of two tables. A
-- link whose target has been deleted resolves to nothing and answers 404,
-- which is the same thing a revoked link does.
--
-- Additive only, and every statement is safe to run twice.
create table if not exists preview_links (
  id           text        primary key,
  -- Hex SHA-256 of the token in the URL. Never the token.
  token_hash   text        not null,
  target_kind  text        not null check (target_kind in ('page', 'post')),
  target_id    text        not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  -- Null while the link works. Kept rather than deleted, so the dashboard can
  -- still say a link existed and was turned off.
  revoked_at   timestamptz,
  -- Who made it, as the dashboard names them. Text rather than a reference to
  -- admin_users: the bootstrap password belongs to no account, and removing an
  -- administrator must not take their links' history with them.
  created_by   text        not null default ''
);

-- The dashboard lists a draft's links every time it is opened.
create index if not exists preview_links_target_idx
  on preview_links (target_kind, target_id);
