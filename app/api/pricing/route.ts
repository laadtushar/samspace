import { NextResponse } from "next/server";
import { countryFromHeaders, COUNTRY_HEADER } from "@/lib/geo";
import { pricingFor } from "@/lib/pricing";
import { publicContent } from "@/lib/content";
import { currencyForCountry } from "@/lib/country-currency";
import { rateFor } from "@/lib/fx-store";
import { ruleFor } from "@/lib/country-store";
import { log, errorFields } from "@/lib/log";

/**
 * The scale, priced for whoever is asking.
 *
 * The pages themselves stay static. Every public route here is ISR — one cached
 * copy of the HTML served to everyone — so a price that depends on the visitor
 * cannot be rendered into it without either giving up that cache or splitting
 * it per country. This is the other way: the page ships the rupee figures, and
 * this endpoint says what they should read as, once.
 *
 * That also keeps the rupee price the one a crawler sees, which is the one the
 * structured data quotes and the one the invoice will say.
 *
 * Cached at the edge per country rather than per visitor. `Vary` on Vercel's
 * own country header means one stored response for everyone in a country and a
 * function invocation only when that response expires.
 */
/*
  Explicitly dynamic. Reading the request's headers already opts a route handler
  out of static rendering, but saying so keeps the route from silently going
  static if that read ever moves — and a static copy of this would serve one
  country's prices to every country.
*/
export const dynamic = "force-dynamic";

/**
 * An hour, matching how long content itself is held.
 *
 * Rates move slowly and the figure is labelled approximate; there is nothing to
 * gain from a fresher one and a per-visitor invocation to lose.
 */
const EDGE_SECONDS = 3600;

export async function GET(request: Request) {
  const country = countryFromHeaders(request.headers);

  // A storage hiccup should cost a conversion, not the prices themselves.
  const content = await publicContent();

  /*
    The rate comes from the practice's own table. A currency with no rate in it
    is simply quoted in rupees — which is what every currency did before there
    was anywhere to keep one, and is never wrong, only less helpful.

    Read failures are swallowed on purpose. The tier rules do not depend on a
    rate, so a database hiccup should cost the conversion and nothing else:
    prices still render, in the currency they are actually billed in.
  */
  const currency = currencyForCountry(country);

  /*
    Both reads swallow their failures, and for the same reason: neither the
    rate nor the country's settings decide which tiers exist, so a database
    hiccup should cost the conversion and nothing else. Prices still render,
    in the currency they are actually billed in.
  */
  const [rate, rule] = await Promise.all([
    rateFor(currency).catch((error) => {
      log.error("pricing.rate_unreadable", { currency, ...errorFields(error) });
      return null;
    }),
    ruleFor(country).catch((error) => {
      log.error("pricing.country_unreadable", { country, ...errorFields(error) });
      return null;
    }),
  ]);

  const view = pricingFor(content.slidingScale, country, rate, { rule });

  return NextResponse.json(view, {
    headers: {
      /*
        CDN-Cache-Control, not Cache-Control, and that distinction is the whole
        of this route's caching.

        Next emits its own `Cache-Control: no-store` for any dynamic route.
        Setting a second one does not replace it — the response goes out
        carrying both, and a cache reading two conflicting values takes the
        first. Checked against a real build rather than assumed: the edge
        caching this route exists for would never have happened.

        CDN-Cache-Control addresses the Vercel CDN alone and leaves the browser
        header to Next, which is the right split anyway: shared per country at
        the edge, never stored per visitor.
      */
      "CDN-Cache-Control": `public, s-maxage=${EDGE_SECONDS}, stale-while-revalidate=${EDGE_SECONDS}`,
      Vary: COUNTRY_HEADER,
      // The prices are public; the country this was priced for is the
      // requester's own, and saying so costs nothing.
      "X-Priced-For": country || "unknown",
    },
  });
}
