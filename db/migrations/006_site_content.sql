-- Site content, moved out of blob storage.
--
-- Blob is billed per operation and content is read on every deployment: each
-- read is a head plus a fetch, the cache key is scoped to the build so every
-- deployment starts cold, and ten routes read it. That is what took the account
-- to 100% of a monthly free tier — not visitors, of whom there were two in the
-- hour the limit was hit.
--
-- The sharper reason is what a paused store costs. Content is the only copy of
-- the booking link, the WhatsApp handle and every word edited in the dashboard;
-- the shipped defaults carry none of them. Falling back to defaults keeps the
-- site up and takes the booking step off the intake form, which is the one
-- thing the site exists to do.
--
-- One row. Content is a single document and always has been — the dashboard
-- reads it whole, writes it whole, and mergeContent puts the defaults
-- underneath. A table of key-value pairs would model something this is not.
--
-- Additive only, and every statement is safe to run twice.
create table if not exists site_content (
  -- Fixed, so an upsert is a primary-key conflict and two writers cannot end up
  -- with a row each.
  id         text        primary key default 'site',
  content    jsonb       not null,
  updated_at timestamptz not null default now(),
  constraint site_content_single_row check (id = 'site')
);
