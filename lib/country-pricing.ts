import { parseRate, formatRate } from "@/lib/rates";

/**
 * What a country is charged, before anything is converted.
 *
 * Two decisions live here and they are deliberately not the same one:
 *
 *   Whether a country is priced in its own money at all — an act with a name
 *   on it, not a side effect of a rate existing.
 *
 *   What rupee figure that conversion starts from — the base scale, the base
 *   scale marked up, or amounts typed for that country specifically.
 *
 * Everything here is rupees. A converted figure is never stored: conversion
 * happens per request from a rate that has an age, and a foreign amount sitting
 * in a table is a price nobody can tell is stale.
 */

/**
 * Beyond any markup a practice would really charge, so a number above it is a
 * typo — caught here rather than quoted to someone.
 */
export const MAX_MARKUP_PERCENT = 500;

/**
 * Marked-up rupees round up to a multiple of this.
 *
 * ₹800 plus 37% is ₹1096, which reads like a number that fell out of a
 * spreadsheet, because it is. Rounding up keeps it a price someone could have
 * chosen, and up rather than down for the same reason conversion rounds up:
 * the figure shown is never less than the figure intended.
 */
export const MARKUP_STEP = 10;

export interface CountryRule {
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  /** Quoted in its own money. False means rupees, exactly as before. */
  enabled: boolean;
  /**
   * This country's own markup, or null to take the common one.
   *
   * Null and 0 are different answers and both are needed: null is "no opinion,
   * whatever everywhere else is", and 0 is "the base scale here, whatever
   * everywhere else is". Collapsing them would leave no way to say the second.
   */
  markupPercent: number | null;
  /** Replaces the base scale outright. Null or empty means there is none. */
  overrideScale: string[] | null;
}

/** A country code, or null for anything that is not one. */
export function normaliseCountry(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** One amount, marked up and rounded to something sayable. */
export function markUp(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return amount;
  const safe = Number.isFinite(percent) && percent > 0 ? percent : 0;
  if (safe === 0) return amount;
  return Math.ceil((amount * (100 + safe)) / 100 / MARKUP_STEP) * MARKUP_STEP;
}

/**
 * The scale marked up, keeping each entry's wording.
 *
 * An entry with no amount in it is passed through untouched rather than
 * dropped — it is someone's note, and losing it silently is worse than
 * carrying it.
 */
export function applyMarkup(
  scale: readonly string[],
  percent: number
): string[] {
  return scale.map((entry) => {
    const { amount, label } = parseRate(entry);
    if (amount === null || amount <= 0) return entry;
    return formatRate(markUp(amount, percent), label);
  });
}

/**
 * The rupee scale a country is priced from.
 *
 * Absolute wins over markup where it is set: it is the more specific statement,
 * and someone who typed exact amounts for a country meant them.
 *
 * A country that is not enabled is priced from the base scale untouched. A
 * markup exists to be converted alongside; applying it while still quoting
 * rupees would quietly charge that country more in the practice's own currency,
 * which is not what enabling a country is for.
 *
 * Where no override is set, the country's own markup applies, and where it has
 * none, the common one does. Setting the same percentage on forty countries by
 * hand is forty chances to mistype one and no way to change them together
 * afterwards.
 */
export function basisFor(
  base: readonly string[],
  rule: CountryRule | null | undefined,
  defaultMarkupPercent = 0
): string[] {
  if (!rule || !rule.enabled) return [...base];
  if (rule.overrideScale && rule.overrideScale.length > 0) {
    return [...rule.overrideScale];
  }
  return applyMarkup(base, effectiveMarkup(rule, defaultMarkupPercent));
}

/**
 * The markup actually applied to a country, and where it came from.
 *
 * Separate from `basisFor` because the dashboard has to say which of the two
 * is in force — a country reading 60% when the common markup is 50% is either
 * a deliberate exception or a typo, and only the person who set it can tell
 * the difference from a screen that says which.
 */
export function markupSourceFor(
  rule: CountryRule | null | undefined,
  defaultMarkupPercent = 0
): { percent: number; source: "country" | "common" | "none" } {
  if (rule && typeof rule.markupPercent === "number") {
    return { percent: rule.markupPercent, source: "country" };
  }
  if (defaultMarkupPercent > 0) {
    return { percent: defaultMarkupPercent, source: "common" };
  }
  return { percent: 0, source: "none" };
}

/** The markup applied to a country, common one included. */
export function effectiveMarkup(
  rule: CountryRule | null | undefined,
  defaultMarkupPercent = 0
): number {
  return markupSourceFor(rule, defaultMarkupPercent).percent;
}

/** Why a markup was refused, for the dashboard to show. Empty when fine. */
export function markupProblem(percent: unknown): string {
  // Null is a valid answer — it means take the common markup — and an empty
  // box is how someone says it.
  if (percent === null || percent === undefined || percent === "") return "";
  const value = typeof percent === "string" ? Number(percent) : percent;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Enter a markup as a number, like 50 for half as much again.";
  }
  if (value < 0) {
    return "A markup cannot be negative — that would charge less abroad than at home.";
  }
  if (value > MAX_MARKUP_PERCENT) {
    return `A markup above ${MAX_MARKUP_PERCENT}% is almost certainly a typo.`;
  }
  return "";
}

/** Why an override scale was refused. Empty when fine, or when there is none. */
export function overrideProblem(scale: unknown): string {
  if (scale === null || scale === undefined) return "";
  if (!Array.isArray(scale)) return "An override is a list of rates.";
  if (scale.length === 0) return "";
  if (!scale.every((entry) => typeof entry === "string")) {
    return "Every rate in an override is text, like ₹1200.";
  }
  if (!scale.some((entry) => (parseRate(entry).amount ?? 0) > 0)) {
    return "An override needs at least one rupee amount in it.";
  }
  return "";
}

/** A country nothing has been decided about: rupees, no markup, no override. */
export function defaultRule(country: string): CountryRule {
  return {
    country: normaliseCountry(country) ?? "",
    enabled: false,
    // Null, not 0: a country nobody has decided about takes the common markup
    // rather than opting itself out of it.
    markupPercent: null,
    overrideScale: null,
  };
}
