-- Blog images, moved out of blob storage.
--
-- The blob store passed its free-tier limit and began answering 403 on every
-- read. Content, submissions and posts all had somewhere else to be; images
-- were the one thing that did not, and an upload endpoint that cannot write is
-- a blog editor that cannot publish a post with a picture.
--
-- Bytes in Postgres rather than a second object store. The practice publishes a
-- handful of covers a year at 5 MB apiece, which is nothing against the
-- database's allowance, and it means one store to keep alive instead of two —
-- which is the whole point of this change.
--
-- The id is the filename in the URL, so it is generated rather than taken from
-- what was uploaded: a name chosen by whoever is posting must not decide a path.
--
-- Additive only, and safe to run twice.
create table if not exists blog_images (
  id           text        primary key,
  content_type text        not null,
  bytes        bytea       not null,
  -- Kept alongside the bytes so a listing never has to read them to know a size.
  byte_size    integer     not null,
  created_at   timestamptz not null default now()
);
