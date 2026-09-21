import { PRACTICE_CURRENCY, isCurrencyCode } from "@/lib/money";

/**
 * Which money a visitor thinks in, from the country their request came from.
 *
 * Facts only. This says what a country's currency is, and nothing about whether
 * quoting a price in it is a good idea — a currency mid-hyperinflation is still
 * that country's currency. Whether a figure is worth showing is decided further
 * along, where the rate either exists and is fresh or it does not.
 *
 * A country absent from this map resolves to rupees, which is also what happens
 * when the header is missing, unreadable, or the visitor is somewhere the rate
 * feed does not cover. Rupees are never wrong here — they are what the practice
 * actually charges.
 */

/** ISO 3166-1 alpha-2 → ISO 4217. */
const CURRENCY_BY_COUNTRY: Readonly<Record<string, string>> = {
  // ─── South Asia ───
  IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", BT: "BTN", MV: "MVR",
  AF: "AFN",

  // ─── Gulf and the wider Middle East ───
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD",
  LB: "LBP", IL: "ILS", IQ: "IQD", IR: "IRR", SY: "SYP", YE: "YER", TR: "TRY",

  // ─── The eurozone ───
  AT: "EUR", BE: "EUR", HR: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR",
  DE: "EUR", GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR",
  MT: "EUR", NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR",
  // Outside the eurozone, on the euro anyway.
  AD: "EUR", MC: "EUR", SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR",

  // ─── Rest of Europe ───
  GB: "GBP", CH: "CHF", LI: "CHF", NO: "NOK", SE: "SEK", DK: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", RS: "RSD", BA: "BAM",
  MK: "MKD", AL: "ALL", UA: "UAH", BY: "BYN", MD: "MDL", RU: "RUB", GE: "GEL",
  AM: "AMD", AZ: "AZN",

  // ─── The Americas ───
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP",
  PE: "PEN", UY: "UYU", PY: "PYG", BO: "BOB", VE: "VES", CR: "CRC", GT: "GTQ",
  HN: "HNL", NI: "NIO", DO: "DOP", CU: "CUP", JM: "JMD", TT: "TTD", BB: "BBD",
  BS: "BSD", BZ: "BZD", GY: "GYD", SR: "SRD", HT: "HTG",
  // On the US dollar without issuing one.
  PR: "USD", PA: "USD", EC: "USD", SV: "USD", VG: "USD", TC: "USD",

  // ─── East and South-East Asia ───
  CN: "CNY", JP: "JPY", KR: "KRW", TW: "TWD", HK: "HKD", MO: "MOP", MN: "MNT",
  SG: "SGD", MY: "MYR", ID: "IDR", TH: "THB", VN: "VND", PH: "PHP", KH: "KHR",
  LA: "LAK", MM: "MMK", BN: "BND",

  // ─── Central Asia ───
  KZ: "KZT", UZ: "UZS", KG: "KGS", TJ: "TJS", TM: "TMT",

  // ─── Africa ───
  ZA: "ZAR", NG: "NGN", KE: "KES", EG: "EGP", MA: "MAD", DZ: "DZD", TN: "TND",
  LY: "LYD", GH: "GHS", TZ: "TZS", UG: "UGX", ET: "ETB", RW: "RWF", ZM: "ZMW",
  BW: "BWP", NA: "NAD", MZ: "MZN", AO: "AOA", MU: "MUR", SC: "SCR", MG: "MGA",
  MW: "MWK", SD: "SDG", SS: "SSP", SO: "SOS", SN: "XOF", CI: "XOF", ML: "XOF",
  BF: "XOF", NE: "XOF", TG: "XOF", BJ: "XOF", GW: "XOF", CM: "XAF", GA: "XAF",
  CG: "XAF", TD: "XAF", CF: "XAF", GQ: "XAF", CD: "CDF", ZW: "ZWG", LS: "LSL",
  SZ: "SZL", GM: "GMD", SL: "SLE", LR: "LRD", GN: "GNF", CV: "CVE", DJ: "DJF",
  ER: "ERN", BI: "BIF",

  // ─── Oceania ───
  AU: "AUD", NZ: "NZD", FJ: "FJD", PG: "PGK", SB: "SBD", VU: "VUV", WS: "WST",
  TO: "TOP", NC: "XPF", PF: "XPF",
  // On another country's currency.
  NR: "AUD", KI: "AUD", TV: "AUD", CK: "NZD", NU: "NZD",
};

/** Two uppercase letters, which is all an alpha-2 country code is. */
export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

/**
 * The currency to quote to someone in this country.
 *
 * Case-insensitive and forgiving of surrounding space, because this comes off a
 * request header and a header is whatever arrives. Anything unrecognised — a
 * country not listed, a malformed value, nothing at all — is rupees.
 */
export function currencyForCountry(country: unknown): string {
  if (typeof country !== "string") return PRACTICE_CURRENCY;
  const code = country.trim().toUpperCase();
  if (!isCountryCode(code)) return PRACTICE_CURRENCY;
  return CURRENCY_BY_COUNTRY[code] ?? PRACTICE_CURRENCY;
}

/** Every currency this map can resolve to, for fetching rates. */
export function currenciesInUse(): string[] {
  return [...new Set(Object.values(CURRENCY_BY_COUNTRY))]
    .filter((code) => code !== PRACTICE_CURRENCY && isCurrencyCode(code))
    .sort();
}

/**
 * Every country the map knows, sorted.
 *
 * The dashboard offers these to choose from. A country that is not here cannot
 * be enabled usefully — it would resolve to rupees whatever was set — so the
 * picker is built from the map itself rather than from a separate list that
 * could drift out of step with it.
 */
export function mappedCountries(): string[] {
  return Object.keys(CURRENCY_BY_COUNTRY).sort();
}

/** How many countries are mapped. Exposed so a test can notice the map shrinking. */
export const MAPPED_COUNTRY_COUNT = Object.keys(CURRENCY_BY_COUNTRY).length;
