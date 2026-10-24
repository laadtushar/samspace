-- Standalone pages, such as a landing page for one kind of client.
--
-- A page is served at /<slug>, beside the site's own routes, and is written in
-- the dashboard the way a post is. It is not a post: it has no date in an
-- archive, no tags, no place in the feed, and it should not appear in the list
-- of writing. Giving it its own table keeps every query that reads posts from
-- having to remember to leave pages out.
--
-- Additive only, and every statement is safe to run twice.

-- id is text for the same reason as blog_posts.id: the application supplies
-- it, and the schema that validates it accepts any string up to 64 characters.
create table if not exists pages (
  id              text        primary key,
  slug            text        not null,
  title           text        not null,
  content         text        not null,
  -- Constrained here as well as in the application. A page published by a
  -- typo in a hand-written statement would go straight into the sitemap.
  status          text        not null default 'draft'
                              check (status in ('draft', 'published')),
  seo_title       text        not null default '',
  seo_description text        not null default '',
  -- Null until the page is first published, as with posts.
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- The slug is the page's URL, so two pages cannot share one. Lowercased to
-- agree with the slug pattern, which already forbids uppercase.
create unique index if not exists pages_slug_key on pages (lower(slug));

-- The sitemap asks for published pages, every hour.
create index if not exists pages_status_idx on pages (status);
