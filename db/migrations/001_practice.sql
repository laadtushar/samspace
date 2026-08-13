-- Practice management: clients, the intake submissions that create them, and
-- the sessions they attend.
--
-- Additive only, and every statement is safe if run twice. The runner records
-- what it has applied, but a migration that can be repeated is one that cannot
-- half-destroy a database when something is interrupted. Nothing here drops or
-- rewrites anything.

create extension if not exists "pgcrypto";

-- A person the practice knows. Created from an intake submission and outlives
-- it: the submission is what they said on one day, the client is who they are.
create table if not exists clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text        not null,
  email              text        not null,
  whatsapp           text,
  gender             text,
  age                integer,
  education          text,
  preferred_language text,
  -- enquiry: has filled the form. active: seeing them. paused / ended: not.
  status             text        not null default 'enquiry',
  agreed_rate        text,
  student_rate       boolean     not null default false,
  admin_note         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists clients_status_idx  on clients (status);
create index if not exists clients_created_idx on clients (created_at desc);
create unique index if not exists clients_email_key on clients (lower(email));

-- What someone submitted, kept as written. Never edited: if a detail changes it
-- changes on the client, not in the record of what they originally said.
create table if not exists submissions (
  id                 uuid primary key,
  client_id          uuid references clients (id) on delete set null,
  name               text        not null,
  email              text        not null,
  whatsapp           text,
  gender             text,
  age                text,
  education          text,
  preferred_language text,
  concerns           text,
  sliding_scale      text,
  student_confirmed  boolean     not null default false,
  scheduling         text,
  created_at         timestamptz not null default now()
);

create index if not exists submissions_client_idx  on submissions (client_id);
create index if not exists submissions_created_idx on submissions (created_at desc);

-- A booked session. google_event_id links it to the calendar entry so the two
-- can be reconciled rather than silently diverging.
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid        not null references clients (id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  -- scheduled | completed | cancelled | no_show
  status          text        not null default 'scheduled',
  rate_amount     integer,
  paid            boolean     not null default false,
  google_event_id text,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists sessions_client_idx on sessions (client_id, starts_at desc);
create index if not exists sessions_starts_idx on sessions (starts_at);
create unique index if not exists sessions_google_event_key
  on sessions (google_event_id) where google_event_id is not null;
