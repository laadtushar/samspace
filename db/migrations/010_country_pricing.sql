-- Which countries are quoted in their own money, and on what basis.
--
-- Before this, a country was converted if a rate for its currency happened to
-- exist. That made enabling Germany a side effect of adding a euro rate, and
-- there was no way to add a rate without also changing what Germans saw. The
-- two decisions are now separate: a rate says what a euro is worth, this says
-- whether euros are quoted at all.
--
-- Absent means not enabled. A country with no row here is quoted in rupees,
-- which is what every country did before there was a row to add — so the
-- default is the behaviour that was already correct, and turning a country on
-- is a deliberate act with a name on it.
--
-- Two ways to mark a price up, because they answer different questions:
--
--   markup_percent  — "everywhere abroad costs half as much again". Applies to
--                     the whole scale, and follows the scale when it changes.
--   override_scale  — "the UAE pays exactly these rupee amounts". Wins where
--                     it is set, and does not move when the base scale does.
--
-- Both are rupees. Nothing here stores a converted figure: conversion happens
-- at request time from a rate that has an age, and a stored foreign amount
-- would be a price nobody could tell was stale.
--
-- Additive only, and every statement is safe to run twice.

create table if not exists country_pricing (
  -- ISO 3166-1 alpha-2, as Vercel's own geo header spells it.
  country        char(2)     primary key,
  enabled        boolean     not null default false,
  -- Percent added to every tier of the base scale. 0 is the scale unchanged.
  markup_percent numeric     not null default 0,
  -- The stored sliding-scale form — ["₹1200","₹1400"] — so it parses with the
  -- same code the base scale does rather than inventing a second kind of price.
  override_scale jsonb,
  updated_at     timestamptz not null default now()
);

-- Alpha-2 is two uppercase letters. A lowercase one would silently never match
-- the header, which is the worst kind of wrong: it looks configured.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'country_pricing_alpha2'
  ) then
    alter table country_pricing
      add constraint country_pricing_alpha2 check (country ~ '^[A-Z]{2}$');
  end if;
end
$$;

-- A negative markup is a discount for being abroad, which is not a thing this
-- practice offers and is far more likely to be a missing keystroke. The upper
-- bound is equally arbitrary and equally deliberate: 500% is beyond any real
-- markup, so a number above it is a typo caught before anyone is quoted it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'country_pricing_markup_range'
  ) then
    alter table country_pricing
      add constraint country_pricing_markup_range
      check (markup_percent >= 0 and markup_percent <= 500);
  end if;
end
$$;

-- An override is a list of rates or it is nothing. A stored object or number
-- would reach the parser as something it has no reading for.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'country_pricing_override_is_list'
  ) then
    alter table country_pricing
      add constraint country_pricing_override_is_list
      check (override_scale is null or jsonb_typeof(override_scale) = 'array');
  end if;
end
$$;

-- The dashboard lists enabled countries first and the rest alphabetically;
-- the table is at most a couple of hundred rows, but the read is on the
-- request path for every visitor, so it is worth not scanning.
create index if not exists country_pricing_enabled_idx
  on country_pricing (enabled) where enabled;
