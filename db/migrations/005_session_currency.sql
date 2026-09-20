-- A stored amount of money that does not say which money it is.
--
-- sessions.rate_amount is a bare integer. It has meant rupees since the table
-- was created, by convention and nowhere else — no column says so. The moment a
-- second currency exists anywhere near this practice, every row already in here
-- becomes a number whose meaning has to be guessed from when it was written.
--
-- That is the classic way money data goes wrong, and the fix is only cheap
-- before the second currency arrives, which is now.
--
-- clients.agreed_rate is deliberately left alone: it is free text the
-- practitioner types ("₹800 (Student)"), and it carries its own symbol, so it
-- says what it means already.
--
-- Additive only, and every statement is safe to run twice.

alter table sessions
  add column if not exists currency text not null default 'INR';

-- Existing rows predate the column and were rupees. The default has already
-- written 'INR' into them; this states the intent for anyone reading later.
update sessions set currency = 'INR' where currency is null or currency = '';

-- ISO 4217 is three uppercase letters. Anything else is a typo or a symbol
-- someone pasted, and either way it is not a currency this can convert from.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_currency_iso4217'
  ) then
    alter table sessions
      add constraint sessions_currency_iso4217
      check (currency ~ '^[A-Z]{3}$');
  end if;
end
$$;
