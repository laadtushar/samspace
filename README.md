# Samvriti.Space

Website for Samvriti.Space — Priyanka Varma's online therapy and academic
mentoring practice. Next.js 14 (App Router), TypeScript, Tailwind, deployed on
Vercel.

## What's here

| Area | Route | Notes |
| --- | --- | --- |
| Marketing site | `/` | Single page; all copy is editable from the dashboard |
| Intake form | `/?intake=true` | Multi-step, optional Calendly booking, sliding-scale rate |
| Blog | `/blog`, `/blog/[slug]` | Written and published from the dashboard |
| RSS | `/blog/rss.xml` | |
| Admin dashboard | `/admin` | Submissions, site content, blog posts |

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. The dashboard is at http://localhost:3000/admin.

Without `BLOB_READ_WRITE_TOKEN` the site still renders — content falls back to
the defaults in `lib/content.ts` — but nothing can be saved.

## Environment variables

Every variable is documented in [`.env.example`](.env.example). The three that
must be set for the site to be usable in production:

- `DATABASE_URL` — Neon Postgres. Migrations run from the build script, so a
  deployment without it fails at build rather than quietly at runtime.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob storage. Set automatically when a Blob
  store is linked to the project on Vercel.
- `ADMIN_PASSWORD` — the bootstrap way into the dashboard, and only until the
  first real account exists. Once one administrator has a password and is
  enabled it stops being accepted, because keeping it alive alongside real
  accounts would mean every protection on them could be walked around by
  whoever still had the shared secret.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest — validation, escaping, rate limiting, auth
npm run build
```

CI runs all four on every pull request (`.github/workflows/ci.yml`).

## How data is stored

Two stores, and which one holds what matters.

**Postgres (Neon)** is the practice's own records — clients, sessions,
reminders and administrator accounts. Schema in `db/migrations/`, applied at
deploy time by `scripts/migrate.mjs` against a `_migrations` ledger.

**Vercel Blob** is everything the public site renders.

| What | Where | Access |
| --- | --- | --- |
| Site content | `site-content.json` | public |
| Blog posts | `blog/<slug>.json` | **encrypted** |
| Blog images | `blog-images/*` | public |
| Intake submissions | `submissions/<timestamp>-<id>.json` | **encrypted** |

Blob is billed per request, and every public page reads content while the post
list is one list call plus one read per post. Both public reads therefore go
through `unstable_cache` with an hour's lifetime — `getCachedContent` and
`getCachedPublishedPosts` — so storage is touched per hour rather than per page
regeneration. Every write clears its tag (`bustCache`), so an edit still appears
immediately; `tests/cache-invalidation.test.ts` pins that, because a write path
that skipped it would look like a broken site rather than a warm cache.

The dashboard deliberately reads `getContent` and `getAllPosts` uncached: it has
to show what is stored, not what was stored an hour ago.

Two decisions worth knowing about:

**Submissions are encrypted and one-blob-per-record.** They contain
mental-health information. Vercel Blob fixes a store's access level when the
store is created, and this project's store is public — `access: "private"` is
rejected outright — so every object is fetchable by anyone holding its URL no
matter what the code asks for. Confidentiality therefore lives in the payload:
records are encrypted with AES-256-GCM (`lib/crypto.ts`) before being written,
which makes the URL worthless without `SUBMISSIONS_ENCRYPTION_KEY`. Blog posts
are encrypted the same way so drafts are not readable from storage.

Each submission is also its own object — the earlier design appended to a
single shared JSON document, which meant two people submitting at the same
moment could overwrite each other and a transient read failure could replace
the whole history with one record.

If you would rather rely on access control than on encryption, create a store
with `vercel blob create-store <name> --access private` and point the project
at it. Note that blog cover images would then need to be served through an API
route, since a private store has no public CDN URLs.

**If you are upgrading an existing deployment**, submissions written before this
change are still in a public blob at `intake-submissions.json`. Log into
`/admin`, open the Submissions tab, and use **Migrate legacy submissions** — it
copies them into private storage and deletes the public copy. That file was
readable by anyone who knew its URL, so afterwards rotate
`BLOB_READ_WRITE_TOKEN` in the Vercel dashboard and treat the old contents as
disclosed.

## Sliding scale and the student rate

Rates are configured in the dashboard as one row each — an amount and an
optional label. A row cannot hold two rates, which a textarea could: a missed
newline used to produce a single entry reading `₹500 (Student)  ₹600`, and
since every consumer pulled the number back out by taking every digit in the
string, that read as ₹500600. Where such an entry already exists the row offers
to split it.

### Writing a price without typing the figure

A rate is typed in the rates list and referenced everywhere else, so a change is
one edit rather than a hunt through the FAQ, the services card and every
published post:

| Token | Resolves to |
| --- | --- |
| `{{rate.range}}` | the full scale, e.g. `₹500–₹1000` |
| `{{rate.lowest}}` | the lowest rate |
| `{{rate.highest}}` | the highest rate |
| `{{rate.student}}` | the concessional rate, if there is one |

They work in site content and in post bodies and excerpts, and resolve on the
way out to the public site — not in `getContent`, because the dashboard has to
see the token to edit it. A token with nothing behind it stays visible rather
than rendering blank, so a typo is something you can see.

Existing copy with literal figures keeps working; nothing was migrated.
Anything with `(Student)` in the label is treated as the concessional rate: a
person choosing it is shown a short note explaining who the rate is funded by
and asked to confirm they're a student. The API enforces the same rule, so a
request that skips the form cannot claim the rate either. Nobody choosing
another rate ever sees that step.

### Changing a rate that is already published

The figure appears in more than one place: the rates list, the services card,
the FAQ answer, and the body of any post that quotes it. Those are all stored
copy, so editing `defaultContent` moves only what the code owns — the
structured data, the share cards and the intake form's fallback — and leaves
the live site quoting the old number.

**Session Rates → Change a rate everywhere** does the whole set in one pass.
Type the old and new amounts as plain numbers — the ₹ is printed beside the
field rather than typed — press **Preview** to see every place that would
change, then apply. Owner-only, and both values must be whole rupee amounts, so
it cannot be used as a general find-and-replace over the site. `₹500` will not
match inside `₹5000`.

## Scheduling

Paste a booking link into **Scheduling** in the dashboard and an optional
booking step appears as the intake form's first step. Clear the field and the
step disappears. Booking is never required — people can skip it and submit the
form regardless.

Calendly and [Cal ID](https://cal.id/) are both supported. The dashboard names
whichever one it recognises and shows the setup steps for that one only.

Providers are described in one place, `lib/scheduling.ts`: the hosts the schema
will store, the query parameters that make a booking page embeddable, and the
`postMessage` that means a slot was taken. Everything else — the schema, the
intake form, the settings panel — reads from that list, so a third provider is a
new entry and nothing else. Splitting it across those four places is how a link
the dashboard calls valid ends up being one the form refuses to show.

The stored key is still `calendlyUrl`. Renaming a top-level key would orphan the
link already in stored content, because `mergeContent` merges one level deep and
the old key would keep winning.

When a booking page announces a completed booking to the parent frame, the step
marks itself done. Calendly's announcement is well established; Cal's is the
documented embed event, and only fires because the embed parameters are set. The
**I've already booked a slot** link under the calendar stays regardless — an
announcement that never arrives must not be the difference between a booking
counting and not.

## Deployment

Push to `main`; Vercel builds and deploys. Set the environment variables in the
Vercel project settings first.

Recommended, not configured in code:

- Turn on Vercel Firewall rate limiting for `/api/*`. The in-process limiter in
  `lib/rate-limit.ts` is per-instance, which slows abuse down but is not a hard
  global ceiling.
- Put `/admin` behind Vercel Access Protection, so the app password is a second
  factor rather than the only one.
- Add error monitoring (Sentry or Vercel log drains) with PII scrubbing on.

## Session reminders

`/api/cron/reminders` runs hourly on Vercel Cron and emails anyone whose session
starts within the next 24 hours. It needs `CRON_SECRET`, which Vercel sets when
the cron is added; requests without it are refused.

Whether a reminder went out is recorded per session rather than worked out from
the clock, so a run that is missed still catches the session it skipped, and one
that already went out is not repeated. The flag is set only after a successful
send: a failure is retried on the next run rather than silently lost.
