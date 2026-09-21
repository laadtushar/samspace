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

Without `DATABASE_URL` the site still renders — content falls back to the
shipped copy in `lib/default-content.ts`, which is a working site rather than an
empty one — but nothing can be saved and the dashboard's lists are empty.

## Environment variables

Every variable is documented in [`.env.example`](.env.example). The two that
must be set for the site to be usable in production:

- `DATABASE_URL` — Neon Postgres. Migrations run from the build script, so a
  deployment without it fails at build rather than quietly at runtime.
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

**Postgres (Neon)** holds the practice's own records — clients, sessions,
reminders, administrator accounts — and the blog. Schema in `db/migrations/`,
applied at deploy time by `scripts/migrate.mjs` against a `_migrations` ledger.

Postgres holds everything. There is no second store.

| What | Where |
| --- | --- |
| Blog posts | Postgres, `blog_posts` |
| Intake submissions | Postgres, `submissions` |
| Site content | Postgres, `site_content` |
| Blog images | Postgres, `blog_images`, served from `/media/<id>` |

### Why there is only one store

Everything used to live in Vercel Blob. Blob is billed **per operation**, and
the reads added up in a way that had nothing to do with traffic: content was
read by ten routes, each read was a `head` plus a `fetch`, and the cache key was
scoped to the build so every deployment started cold. Reading the blog cost a
list plus one request per post. That spent a monthly allowance in a fortnight —
two visitors in the hour the limit was reached.

Going over does not throttle the store, it **pauses** it. Every read began
answering 403, and because content was the only copy of the booking link and the
WhatsApp handle, the live site served its shipped defaults to everyone with no
way to book. The dashboard returned 500 on the one request every tab waits for,
so the practitioner could not reach the blog, the clients or the sessions
either — all of which were in Postgres and working the whole time.

A second store bought no reliability here. It bought two ways for the same
question to be answered differently, and a state where the copy that mattered
was the one that could not be read. So there is one store, and the failure modes
are the ones a database has.

Posts are stored in plain text, where in blob they were encrypted. That was not
a downgrade: blob fixes a store's access level at creation and this project's
was public, so every object was fetchable by anyone holding its URL and a draft
was hidden from the site but not from storage. Confidentiality had to live in
the payload. A database reached with a connection string has none of those
properties.

### Images

Blog images are bytes in `blog_images`, served from `/media/<id>`.

Two details that are easy to get wrong. The serving route is deliberately **not**
under `/api`: `next.config.mjs` sets `Cache-Control: no-store` on every `/api`
path, which is right for an endpoint that reads a client list and exactly wrong
for a picture, where it would put a database read in front of every view on
every page. And an id is generated rather than taken from the uploaded filename
— the id becomes the URL, so accepting the filename would let whoever is posting
choose a path, and two uploads of `cover.png` would collide and quietly replace
one another.

Because an id never names different bytes, the response is immutable in the
strict sense and is cached for a year. The database is asked once per image per
edge location.

Uploads are restricted to administrators, checked server-side for type and size:
the file input's `accept` attribute is a hint to the file picker, not a control.
What is served is sandboxed by `Content-Security-Policy` and sent with
`nosniff`, because an SVG is a script host and one served from this origin could
otherwise read the admin session.

### Caching

Content is read by every public page, so it goes through `unstable_cache` with
an hour's lifetime. Every write clears its tag (`bustCache`), so an edit appears
immediately; `tests/cache-invalidation.test.ts` pins that, because a write path
that skipped it would look like a broken site rather than a warm cache.

The cache key includes the commit sha. Without it an entry outlives the
deployment that wrote it, and a deployment that adds a field goes on serving an
object shaped by the previous one — which happened, and presented as new copy
simply not appearing.

`publicContent` is the accessor every public page uses. It falls back to the
shipped copy when the store cannot be read, and — this is the part worth knowing
— it **rethrows Next's own signals** rather than answering them with the
fallback. A bare `catch` around the read swallows `DYNAMIC_SERVER_USAGE`, which
is not a failure but Next asking for the route to be rendered on demand.
Answering it with the defaults does not degrade the page, it changes what the
page is: Next prerenders happily, and what it prerenders is the fallback, frozen
into the deployment until the next one. That is exactly how the shipped defaults
ended up on the live homepage.

The dashboard deliberately reads `getContent` and `getAllPosts` uncached: it has
to show what is stored, not what was stored an hour ago. When the store cannot
be read it is served the shipped copy with an `X-Content-Stored: false` header
and shows a banner saying so — it opens during an outage rather than locking its
owner out, and the protection moves to the save, which is then a decision rather
than an accident.

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
| `{{rate.band}}` | the full-rate band, e.g. `₹800–₹1000` |
| `{{rate.standard}}` | the lowest full rate, e.g. `₹800` |

The last two exist because the scale describes two ranges, not one: the whole of
it, and what is left once the concessional rate is set aside. Copy saying
"students pay X, everyone else Y–Z" needs both, and `{{rate.lowest}}` is the
student rate.

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
copy, so editing `defaultContent` changes what a fresh install ships with and
nothing that is already live.

What the code owns no longer holds a figure at all. `priceRange`, `minPrice`,
`maxPrice`, the search description and the share cards are derived from the
rates list at render time (`lib/seo-pricing.ts`), and the intake form's fallback
is the same `DEFAULT_SLIDING_SCALE` constant the server ships. So a rate change
in the dashboard moves the structured data with it, and there is nothing left in
the codebase to forget to update.

**Session Rates → Change a rate everywhere** does the whole set in one pass.
Type the old and new amounts as plain numbers — the ₹ is printed beside the
field rather than typed — press **Preview** to see every place that would
change, then apply. Owner-only, and both values must be whole rupee amounts, so
it cannot be used as a general find-and-replace over the site. `₹500` will not
match inside `₹5000`.

### When the copy stops agreeing with the scale

The reason the above is needed at all is that stored copy shadows the codebase
silently. It went wrong exactly that way: the scale read `₹500 (Student)` while
the FAQ answer two sections below it explained the ₹600 student rate, live, with
the page's own structured data saying `minPrice: 500` at the same time.

So **Session Rates** now compares every price in the stored copy against the
rates on the scale (`lib/price-audit.ts`) and names what disagrees, with the
built-in wording one press away. It reports a range that is neither the scale
nor the band it leaves, a figure that is not a rate on the site, and a declared
price that restates the scale instead of referencing it. It says nothing when
everything agrees, and nothing at all when there are no rates to compare
against — a warning that fires on correct copy is one people learn to ignore.

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
