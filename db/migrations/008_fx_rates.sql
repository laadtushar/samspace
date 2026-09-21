-- Exchange rates, set by the practice.
--
-- Converted prices needed a rate and there was nowhere to keep one, so
-- /api/pricing passed null and always answered in rupees. The obvious source
-- was a feed; none is reachable from here, and guessing at a provider's payload
-- shape is how you ship code that breaks the first time it meets the real one.
--
-- So the practice is the source. pricingFor already takes an FxRate and
-- convertScale already does the hard part — rounding a scale without collapsing
-- two tiers onto the same figure — and neither cares where the number came
-- from. A feed, if one ever becomes reachable, fills this same table.
--
-- numeric, not double precision. A rate is a decimal quantity people type and
-- read back, and per_rupee spans three orders of magnitude across the
-- currencies this might hold — roughly 0.0035 for the Kuwaiti dinar to 1.8 for
-- the yen. Binary floating point would hand back a number that is not the one
-- that was entered.
--
-- One row per currency. Converting into rupees is not a conversion, so the
-- practice's own currency never belongs here.
--
-- Additive only, and safe to run twice.
create table if not exists fx_rates (
  currency   text        primary key,
  per_rupee  numeric(20, 10) not null,
  -- When the rate was true. For a hand-set rate that is when someone set it.
  as_of      timestamptz not null default now(),
  -- How it got here, because it decides how long it may be quoted for. A fetched
  -- rate two weeks old means the fetcher is broken; a typed rate two weeks old
  -- means nothing is broken at all.
  source     text        not null default 'manual',
  updated_at timestamptz not null default now(),

  constraint fx_rates_currency_iso4217 check (currency ~ '^[A-Z]{3}$'),
  -- A rate of zero or less is not a slow rate, it is a broken one, and it would
  -- price every tier at nothing.
  constraint fx_rates_positive check (per_rupee > 0),
  constraint fx_rates_known_source check (source in ('manual', 'feed'))
);
