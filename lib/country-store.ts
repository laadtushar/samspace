import { sql, dbConfigured } from "@/lib/db";
import {
  normaliseCountry,
  markupProblem,
  overrideProblem,
  defaultRule,
  type CountryRule,
} from "@/lib/country-pricing";

/**
 * Which countries the practice has decided something about.
 *
 * A country with no row here has had nothing decided, which reads as rupees —
 * so an unreachable table degrades to exactly the behaviour the site had before
 * any of this existed, rather than to an error on a public page.
 */

interface Row {
  country: string;
  enabled: boolean;
  markup_percent: string | number | null;
  override_scale: unknown;
  updated_at: Date | string;
}

/**
 * numeric arrives as a string from pg because it is exact and a float is not.
 * An unreadable one becomes no markup rather than NaN, which would mark every
 * tier up to nothing and quote a free session.
 */
function toRule(row: Row): CountryRule {
  const scale = Array.isArray(row.override_scale)
    ? row.override_scale.filter((entry): entry is string => typeof entry === "string")
    : null;

  return {
    country: row.country.trim().toUpperCase(),
    enabled: row.enabled === true,
    markupPercent: toMarkup(row.markup_percent),
    overrideScale: scale && scale.length > 0 ? scale : null,
  };
}

/**
 * A stored markup, or null for a country that has not set one.
 *
 * Null passes through as null rather than becoming 0: they mean different
 * things here, and turning "no opinion" into "explicitly nothing" would opt
 * every country out of the common markup the moment it was read back.
 *
 * An unreadable value also becomes null — the common markup — rather than NaN,
 * which would mark every tier up to nothing and quote a free session.
 */
function toMarkup(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const markup = Number(value);
  return Number.isFinite(markup) && markup >= 0 ? markup : null;
}

/** Every country with a row, for the dashboard. Empty without a database. */
export async function allCountryRules(): Promise<CountryRule[]> {
  if (!dbConfigured()) return [];
  const rows = (await sql()`
    select country, enabled, markup_percent, override_scale, updated_at
    from country_pricing
    order by enabled desc, country
  `) as unknown as Row[];
  return rows.map(toRule);
}

/**
 * What has been decided about one country, or null.
 *
 * On the request path for every visitor, so it reads one row by primary key.
 */
export async function ruleFor(country: unknown): Promise<CountryRule | null> {
  const code = normaliseCountry(country);
  if (!code || !dbConfigured()) return null;

  const rows = (await sql()`
    select country, enabled, markup_percent, override_scale, updated_at
    from country_pricing
    where country = ${code}
    limit 1
  `) as unknown as Row[];

  return rows[0] ? toRule(rows[0]) : null;
}

/** Why a rule was refused, for the dashboard to show. Empty when it is fine. */
export function ruleProblem(rule: Partial<CountryRule>): string {
  if (!normaliseCountry(rule.country)) {
    return "Use a two-letter country code, like AE or GB.";
  }
  return markupProblem(rule.markupPercent ?? 0) || overrideProblem(rule.overrideScale ?? null);
}

/** Stores a decision about one country, replacing whatever was there. */
export async function saveCountryRule(rule: Partial<CountryRule>): Promise<CountryRule> {
  const problem = ruleProblem(rule);
  if (problem) throw new Error(problem);
  if (!dbConfigured()) {
    throw new Error("No database configured — set DATABASE_URL to save countries.");
  }

  const code = normaliseCountry(rule.country)!;
  // Undefined, null and an empty box all mean the same thing: no markup of its
  // own, so the common one applies. Zero is not one of them.
  const markup =
    rule.markupPercent === null || rule.markupPercent === undefined
      ? null
      : Number(rule.markupPercent);
  const scale =
    Array.isArray(rule.overrideScale) && rule.overrideScale.length > 0
      ? JSON.stringify(rule.overrideScale)
      : null;

  await sql()`
    insert into country_pricing (country, enabled, markup_percent, override_scale, updated_at)
    values (${code}, ${rule.enabled === true}, ${markup}, ${scale}::jsonb, now())
    on conflict (country) do update
      set enabled = excluded.enabled,
          markup_percent = excluded.markup_percent,
          override_scale = excluded.override_scale,
          updated_at = now()
  `;

  return {
    ...defaultRule(code),
    enabled: rule.enabled === true,
    markupPercent: markup,
    overrideScale: Array.isArray(rule.overrideScale) && rule.overrideScale.length > 0
      ? rule.overrideScale
      : null,
  };
}

/**
 * The markup applied to every enabled country that has not set its own.
 *
 * Zero without a database, and zero when the row is unreadable, because the
 * safe direction here is down: a markup that fails to load should quote the
 * practice's own prices, never a figure nobody chose.
 */
export async function defaultMarkup(): Promise<number> {
  if (!dbConfigured()) return 0;
  const rows = (await sql()`
    select default_markup_percent from pricing_settings where id = 'default'
  `) as unknown as { default_markup_percent: string | number }[];

  const markup = Number(rows[0]?.default_markup_percent ?? 0);
  return Number.isFinite(markup) && markup > 0 ? markup : 0;
}

/** Stores the markup applied where a country has not set its own. */
export async function saveDefaultMarkup(percent: unknown): Promise<number> {
  const value = Number(percent ?? 0) || 0;
  const problem = markupProblem(value);
  if (problem) throw new Error(problem);
  if (!dbConfigured()) {
    throw new Error("No database configured — set DATABASE_URL to save a markup.");
  }

  await sql()`
    insert into pricing_settings (id, default_markup_percent, updated_at)
    values ('default', ${value}, now())
    on conflict (id) do update
      set default_markup_percent = excluded.default_markup_percent,
          updated_at = now()
  `;
  return value;
}

/** Removes a country's row, so it goes back to being quoted in rupees. */
export async function deleteCountryRule(country: unknown): Promise<boolean> {
  const code = normaliseCountry(country);
  if (!code || !dbConfigured()) return false;

  const rows = (await sql()`
    delete from country_pricing where country = ${code} returning country
  `) as unknown as { country: string }[];
  return rows.length > 0;
}
