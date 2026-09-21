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
  markup_percent: string | number;
  override_scale: unknown;
  updated_at: Date | string;
}

/**
 * numeric arrives as a string from pg because it is exact and a float is not.
 * An unreadable one becomes no markup rather than NaN, which would mark every
 * tier up to nothing and quote a free session.
 */
function toRule(row: Row): CountryRule {
  const markup = Number(row.markup_percent);
  const scale = Array.isArray(row.override_scale)
    ? row.override_scale.filter((entry): entry is string => typeof entry === "string")
    : null;

  return {
    country: row.country.trim().toUpperCase(),
    enabled: row.enabled === true,
    markupPercent: Number.isFinite(markup) && markup > 0 ? markup : 0,
    overrideScale: scale && scale.length > 0 ? scale : null,
  };
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
  const markup = Number(rule.markupPercent ?? 0) || 0;
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

/** Removes a country's row, so it goes back to being quoted in rupees. */
export async function deleteCountryRule(country: unknown): Promise<boolean> {
  const code = normaliseCountry(country);
  if (!code || !dbConfigured()) return false;

  const rows = (await sql()`
    delete from country_pricing where country = ${code} returning country
  `) as unknown as { country: string }[];
  return rows.length > 0;
}
