-- Records that a reminder went out for a session.
--
-- Kept per session rather than worked out from the clock: a job that misses a
-- run must still catch the session it skipped, and must not send twice for the
-- one it already handled.

alter table sessions
  add column if not exists reminder_sent_at timestamptz;

-- The reminder job asks for scheduled sessions in a window that have not been
-- reminded about; without this it reads every session to find a handful.
create index if not exists sessions_reminder_idx
  on sessions (starts_at)
  where status = 'scheduled' and reminder_sent_at is null;
