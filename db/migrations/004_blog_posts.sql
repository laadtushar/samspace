-- Blog posts, moved out of blob storage.
--
-- Blob is billed per request, and reading the blog cost a list plus one read
-- per post — seven posts was eight requests, from the homepage, the archive,
-- every post page, the sitemap and the feed. That is what took the account to
-- 75% of a monthly free tier. One query returns the same rows.
--
-- Additive only, and every statement is safe to run twice.

-- id is text, not uuid, on purpose. It is supplied by the application, and the
-- schema that validates it (blogPostSchema) accepts any string up to 64
-- characters — so a uuid column would reject input the rest of the system
-- considers valid. Existing ids are carried over from blob unchanged.
create table if not exists blog_posts (
  id              text        primary key,
  slug            text        not null,
  title           text        not null,
  excerpt         text        not null default '',
  content         text        not null,
  cover_image     text        not null default '',
  cover_alt       text        not null default '',
  -- jsonb rather than text[]: the Neon HTTP driver and pg do not decode arrays
  -- identically, and the tests run against pg while production runs against
  -- Neon — a difference there would pass CI and fail live. JSON decodes the
  -- same either way.
  tags            jsonb       not null default '[]'::jsonb,
  status          text        not null default 'draft',
  -- Null until the post is first published. The application represents that as
  -- an empty string; null is what it means in a column.
  published_at    timestamptz,
  updated_at      timestamptz not null default now(),
  seo_title       text        not null default '',
  seo_description text        not null default ''
);

-- The slug is the post's identity and its URL, so two posts cannot share one.
-- Lowercased because the slug pattern already forbids uppercase, and a unique
-- index that disagrees with that would be a trap for anything inserting
-- directly.
create unique index if not exists blog_posts_slug_key on blog_posts (lower(slug));

-- The public site asks for published posts newest first, every time.
create index if not exists blog_posts_published_idx
  on blog_posts (status, published_at desc);

-- Posts are stored in plain text here, unlike in blob.
--
-- They were encrypted because the blob store is public at the store level: its
-- access level is fixed at creation, every object is fetchable by anyone
-- holding its URL, and a draft is hidden from the site but not from storage.
-- None of that is true of a database reached with a connection string, so the
-- encryption was protecting against a property this table does not have.
