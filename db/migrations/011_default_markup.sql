-- A markup that applies everywhere, and a country's own where it has one.
--
-- Setting the same percentage on forty countries by hand is forty chances to
-- mistype one, and no way to change them together afterwards. So the markup
-- lives in one place and a country overrides it only when it needs to.
--
-- markup_percent becomes nullable, and that is the whole of the change to it:
--
--   null   — this country has no opinion, so the common markup applies.
--   0      — this country is charged the base scale, whatever the common
--            markup says. Somewhere the practice deliberately wants at par.
--   n      — this country is marked up by n, whatever the common markup says.
--
-- Existing rows holding 0 are converted to null. Today 0 is what a country
-- gets when nobody has typed anything, because there was no common markup to
-- inherit from — so 0 means "nothing set" in every row written so far, and
-- leaving them at 0 would silently opt every configured country out of the
-- setting this migration exists to add.
--
-- Additive, and every statement is safe to run twice.

create table if not exists pricing_settings (
  -- One row. The constraint is what makes it one row rather than a convention
  -- that holds until someone inserts a second.
  id                     text        primary key default 'default'
                                     check (id = 'default'),
  -- Percent added to every enabled country that has not set its own.
  default_markup_percent numeric     not null default 0,
  updated_at             timestamptz not null default now()
);

insert into pricing_settings (id, default_markup_percent)
values ('default', 0)
on conflict (id) do nothing;

-- Same bounds as a country's own markup, and for the same reasons: a negative
-- markup is a discount for being abroad, which this practice does not offer
-- and which is far more likely to be a missing keystroke; 500% is past any
-- real markup, so a number above it is a typo caught before anyone is quoted.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pricing_settings_markup_range'
  ) then
    alter table pricing_settings
      add constraint pricing_settings_markup_range
      check (default_markup_percent >= 0 and default_markup_percent <= 500);
  end if;
end
$$;

alter table country_pricing alter column markup_percent drop not null;
alter table country_pricing alter column markup_percent drop default;

-- Only the rows that predate the common markup, which is every row holding 0
-- at the moment this first runs. The marker is what makes that "first runs"
-- rather than "every time": without it a second run would null out a 0 that
-- somebody has since typed deliberately, which is the one value this setting
-- gives them a way to express.
alter table pricing_settings
  add column if not exists markup_backfilled boolean not null default false;

update country_pricing
   set markup_percent = null
 where markup_percent = 0
   and exists (select 1 from pricing_settings where not markup_backfilled);

update pricing_settings set markup_backfilled = true where not markup_backfilled;
