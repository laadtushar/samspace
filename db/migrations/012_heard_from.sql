-- Where an enquiry says it heard about the practice.
--
-- Analytics can name the site that sent a visitor, but not the friend who
-- recommended the practice or the college notice board someone read. The
-- intake form now asks, optionally, and this is where the answer is kept.
--
-- heard_from holds a stable key from lib/referral.ts ("instagram", "friend",
-- ...); heard_from_detail holds the free text given with "Somewhere else".
-- Both are null for every submission made before the question existed, which
-- is the truth: those people were never asked.
--
-- Additive only, and every statement is safe to run twice.

alter table submissions
  add column if not exists heard_from        text,
  add column if not exists heard_from_detail text;
