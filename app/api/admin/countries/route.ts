import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { dbConfigured } from "@/lib/db";
import {
  allCountryRules,
  saveCountryRule,
  deleteCountryRule,
  ruleProblem,
  defaultMarkup,
  saveDefaultMarkup,
} from "@/lib/country-store";
import { allRates } from "@/lib/fx-store";
import { previewFor } from "@/lib/country-preview";
import { publicContent } from "@/lib/content";
import { normaliseCountry, defaultRule, markupProblem } from "@/lib/country-pricing";
import { currencyForCountry } from "@/lib/country-currency";
import { localCurrencyEnabled } from "@/lib/local-currency";
import { log, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Which countries are quoted in their own money, and what each one sees.
 *
 * Every row comes back with the figures a visitor there is actually served,
 * produced by the same call the public endpoint makes. A settings page that
 * computed its own preview would eventually disagree with the site, and the
 * disagreement would be invisible until someone abroad complained.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "Country settings are not configured." },
      { status: 503 }
    );
  }

  const [rules, rates, content, commonMarkup] = await Promise.all([
    allCountryRules(),
    allRates(),
    publicContent(),
    defaultMarkup(),
  ]);

  const now = new Date();
  const rateFor = new Map(rates.map((rate) => [rate.currency, rate]));
  const countries = rules.map((rule) =>
    previewFor(
      content.slidingScale,
      rule,
      rateFor.get(currencyForCountry(rule.country)) ?? null,
      now,
      commonMarkup
    )
  );

  return NextResponse.json({
    countries,
    defaultMarkupPercent: commonMarkup,
    /*
      The master switch, reported rather than assumed. Every country here can
      be enabled and correct and still show rupees, because LOCAL_CURRENCY
      gates the whole feature — and someone looking at a page full of
      correctly-configured countries deserves to be told that.
    */
    localCurrencyEnabled: localCurrencyEnabled(),
    scale: content.slidingScale,
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Upper-cased here rather than demanded of whoever is typing: "ae" is not a
  // mistake worth an error message.
  const country = normaliseCountry(body.country);
  /*
    An absent or empty markup is not zero. It means this country has no
    opinion and takes the common one, which is a different instruction from
    charging the base scale here — and the only way to say the second is to
    type a nought.
  */
  const typed = String(body.markupPercent ?? "").trim();
  const markupPercent =
    body.markupPercent === null || body.markupPercent === undefined || typed === ""
      ? null
      : typeof body.markupPercent === "number"
        ? body.markupPercent
        : Number(typed);

  const overrideScale = Array.isArray(body.overrideScale)
    ? body.overrideScale.filter((entry): entry is string => typeof entry === "string")
    : null;

  const rule = {
    ...defaultRule(country ?? ""),
    enabled: body.enabled === true,
    markupPercent,
    overrideScale: overrideScale && overrideScale.length > 0 ? overrideScale : null,
  };

  const problem = ruleProblem(rule);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const saved = await saveCountryRule(rule);
    return NextResponse.json({ success: true, country: saved });
  } catch (error) {
    log.error("countries.save_failed", { country, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not save that country." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const country = new URL(req.url).searchParams.get("country");
  if (!normaliseCountry(country)) {
    return NextResponse.json({ error: "Which country?" }, { status: 400 });
  }

  try {
    // Removing a country is not an error when it was never there: the caller
    // wanted it gone, and it is gone.
    await deleteCountryRule(country);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("countries.delete_failed", { country, ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not remove that country." },
      { status: 500 }
    );
  }
}

/**
 * The markup applied where a country has not set one of its own.
 *
 * A separate method rather than a field on the country save: it is a setting
 * for the whole list, and folding it into the call that writes one country
 * would make "save the UAE" a call that can silently reprice everywhere else.
 */
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const problem = markupProblem(body.defaultMarkupPercent ?? 0);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const saved = await saveDefaultMarkup(body.defaultMarkupPercent ?? 0);
    return NextResponse.json({ success: true, defaultMarkupPercent: saved });
  } catch (error) {
    log.error("countries.markup_save_failed", { ...errorFields(error) });
    return NextResponse.json(
      { error: "Could not save that markup." },
      { status: 500 }
    );
  }
}
