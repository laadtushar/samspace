import { rateAmount, priceRangeOf } from "@/lib/rates";
import type { SiteContent } from "@/lib/default-content";

/**
 * Every price the site publishes as data, read off the rates list.
 *
 * The search description, the share cards and the structured data all quote a
 * figure, and all four were typed into the root layout. That is the same drift the
 * rest of the site uses tokens to avoid: a rate changed in the dashboard moved
 * the visible page and left `priceRange` and `minPrice` advertising the old one —
 * which is worse than a stale sentence, because a search result is where someone
 * decides whether they can afford this at all.
 *
 * Structured data cannot hold a token, so it is resolved here instead.
 */
export function pricingFrom(content: SiteContent) {
  const amounts = content.slidingScale
    .map(rateAmount)
    .filter((n): n is number => n !== null && n > 0);

  /*
    Mentoring is priced on its own rather than on the scale, so it is read from
    the services list: the one entry quoting a single figure rather than a range.
    Nothing is published when that is ambiguous — no offer beats a wrong price,
    and a guess here would be a guess about what someone is being charged.
  */
  const singles = content.services.items
    .map((item) => item.price)
    .filter((price): price is string => typeof price === "string" && !price.includes("–"))
    .map(rateAmount)
    .filter((n): n is number => n !== null && n > 0);

  return {
    range: priceRangeOf(content.slidingScale),
    lowest: amounts.length > 0 ? Math.min(...amounts) : null,
    highest: amounts.length > 0 ? Math.max(...amounts) : null,
    mentoring: singles.length === 1 ? singles[0] : null,
  };
}
