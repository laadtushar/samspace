-- What a submission agreed to pay, as a number and in a named currency.
--
-- sliding_scale holds what the person saw — "₹800", or "₹500 (Student)" — and
-- that is worth keeping, because it is the exact wording they agreed to. It is
-- also the only record of the amount, and nothing can do arithmetic on it: a
-- report, a total, or a comparison against what a session was billed at all
-- have to parse a string with a symbol and an optional label in it.
--
-- So the amount is recorded as a number beside it. The text stays as written.
--
-- The currency is named for the same reason it was named on sessions: every
-- amount here is rupees today, and a column that says so is a column that
-- cannot be misread later. When the intake form does show converted prices,
-- this is where it says which — the rupee amount stays the one that is
-- charged, and nothing re-derives an amount from what was displayed.
--
-- Additive only, and every statement is safe to run twice.

alter table submissions
  -- Rupees, whole. The scale has never had paise in it and a fractional
  -- consultation fee is not a thing this practice charges.
  add column if not exists rate_amount integer,
  add column if not exists currency    text not null default 'INR';

-- Existing rows predate both columns and were rupees. The default has already
-- written 'INR'; this states the intent for anyone reading later.
update submissions set currency = 'INR' where currency is null or currency = '';

-- ISO 4217 is three uppercase letters. Anything else is a typo or a symbol
-- someone pasted, and either way it is not a currency this can reconcile.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submissions_currency_iso4217'
  ) then
    alter table submissions
      add constraint submissions_currency_iso4217
      check (currency ~ '^[A-Z]{3}$');
  end if;
end
$$;

-- A negative fee is not a discount, it is a broken parse.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submissions_rate_not_negative'
  ) then
    alter table submissions
      add constraint submissions_rate_not_negative
      check (rate_amount is null or rate_amount >= 0);
  end if;
end
$$;
