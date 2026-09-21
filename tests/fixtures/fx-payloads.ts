/**
 * Real responses, captured 2026-09-21.
 *
 * Trimmed for length but structurally untouched: the shapes, the key casing,
 * the timestamp fields and the junk entries are exactly as each provider sent
 * them. The junk is kept deliberately — crypto, metals and currencies
 * withdrawn decades ago are what the filter exists to remove, and a fixture
 * with only clean data would not test it.
 */

/** open.er-api.com/v6/latest/INR */
export const erApiPayload = {
  result: "success",
  provider: "https://www.exchangerate-api.com",
  documentation: "https://www.exchangerate-api.com/docs/free",
  terms_of_use: "https://www.exchangerate-api.com/terms",
  time_last_update_unix: 1789948951,
  time_last_update_utc: "Mon, 21 Sep 2026 00:02:31 +0000",
  time_next_update_unix: 1790036621,
  time_next_update_utc: "Tue, 22 Sep 2026 00:23:41 +0000",
  time_eol_unix: 0,
  base_code: "INR",
  rates: {
    INR: 1, AED: 0.038235, SAR: 0.039042, QAR: 0.037897, KWD: 0.003215,
    BHD: 0.003915, OMR: 0.004003, USD: 0.010413, GBP: 0.007803,
    EUR: 0.009091, AUD: 0.014622, CAD: 0.014604, SGD: 0.013317,
    NPR: 1.6, LKR: 3.455253, BDT: 1.283657, PKR: 2.895475,
    IRR: 14311.578947, LBP: 931.798743,
  },
} as const;

/** cdn.jsdelivr.net/npm/@fawazahmed0/currency-api — lower case, under a base key. */
export const currencyApiPayload = {
  date: "2026-09-20",
  inr: {
    inr: 1, aed: 0.038273295, sar: 0.039080968, qar: 0.037934593,
    kwd: 0.0032134122, usd: 0.010421592, gbp: 0.0077800348,
    eur: 0.0090731771, sgd: 0.013298143,
    // Not currencies: crypto, metals, and ones long withdrawn.
    btc: 1.2965576e-7, eth: 0.0000040407382, shib: 1940.90687962,
    pepe: 2602.73121489, xau: 0.0000023793348, xag: 0.00015730564,
    zwd: 3.77157397, trl: 508238.09758913, veb: 883131608.6390804,
    // Two-letter and four-letter keys the filter should also drop.
    "1inch": 0.10790152, usdt: 0.010426501,
  },
} as const;

/** api.frankfurter.app/latest?from=INR — every currency it has. */
export const frankfurterPayload = {
  amount: 1.0,
  base: "INR",
  date: "2026-09-21",
  rates: {
    AUD: 0.01462, BRL: 0.05351, CAD: 0.01461, CHF: 0.00857, CNY: 0.06987,
    CZK: 0.22118, DKK: 0.0679, EUR: 0.00908, GBP: 0.00779, HKD: 0.08187,
    HUF: 3.2916, IDR: 186.49, ILS: 0.03143, ISK: 1.2607, JPY: 1.6412,
    KRW: 14.32, MXN: 0.17941, MYR: 0.04255, NOK: 0.09821, NZD: 0.0182,
    PHP: 0.65532, PLN: 0.03954, RON: 0.04782, SEK: 0.10241, SGD: 0.0133,
    THB: 0.34684, TRY: 0.50926, USD: 0.01044, ZAR: 0.16968,
  },
} as const;
