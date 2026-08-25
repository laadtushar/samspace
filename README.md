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

Every variable is documented in [`.env.example`](.env.example). The two that
must be set for the site to be usable in production:

- `ADMIN_PASSWORD` — guards the dashboard. Long and random; it is the only
  thing between the internet and stored client records.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob storage. Set automatically when a Blob
  store is linked to the project on Vercel.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm test            # vitest — validation, escaping, rate limiting, auth
npm run build
```

CI runs all four on every pull request (`.github/workflows/ci.yml`).

## How data is stored

Everything lives in Vercel Blob. There is no database.

| What | Where | Access |
| --- | --- | --- |
| Site content | `site-content.json` | public |
| Blog posts | `blog/<slug>.json` | **encrypted** |
| Blog images | `blog-images/*` | public |
| Intake submissions | `submissions/<timestamp>-<id>.json` | **encrypted** |

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

Rates are configured in the dashboard, one per line, e.g. `₹600 (Student)`.
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
Enter the old and new amounts, press **Preview** to see every place that would
change, then apply. Owner-only, and both values must be plain rupee amounts, so
it cannot be used as a general find-and-replace over the site. `₹500` will not
match inside `₹5000`.

## Scheduling

Paste a Calendly event link into **Scheduling (Calendly)** in the dashboard and
an optional booking step appears as the intake form's first step. Clear the
field and the step disappears. Booking is never required — people can skip it
and submit the form regardless.

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
