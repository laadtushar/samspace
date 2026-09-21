import { isCountryCode } from "@/lib/country-currency";

/**
 * Where a request came from, as far as anyone can tell.
 *
 * Vercel resolves the client IP to a country at the edge and puts it here. It
 * is a guess and is treated as one: a VPN, a corporate proxy, a traveller and
 * an NRI browsing from Delhi all produce a country that is not where the person
 * lives. That is tolerable because of what the answer is used for — which
 * currency to *show* a price in, next to a note saying the invoice comes in
 * rupees — and it would not be tolerable for anything that decided access.
 *
 * Nothing about the visitor is stored, and the IP itself never leaves the edge.
 */
export const COUNTRY_HEADER = "x-vercel-ip-country";

/**
 * The country code on a request, or "" when there is not one to trust.
 *
 * Empty rather than a default country: "unknown" and "India" are different
 * facts, and the pricing rules draw a real line between them — the concessional
 * rate is offered at home and nowhere else, so quietly treating an unreadable
 * header as home would hand it to everyone whose header failed to arrive.
 */
export function countryFromHeaders(headers: Headers | null | undefined): string {
  const raw = headers?.get(COUNTRY_HEADER);
  if (typeof raw !== "string") return "";
  const code = raw.trim().toUpperCase();
  return isCountryCode(code) ? code : "";
}
