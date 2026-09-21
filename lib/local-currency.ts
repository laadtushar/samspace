/**
 * Whether visitors abroad are shown prices in their own currency.
 *
 * Off unless a deployment says otherwise, and read from the environment for
 * the same reason BOTID_MODE is: this is a rollout switch, not editable copy.
 * Putting it in site content would let it be flipped from the dashboard, which
 * is the wrong place for a decision about whether a feature is finished.
 *
 * Not a NEXT_PUBLIC variable. The pages that need it are rendered on the
 * server, which passes the answer down as a prop — so the switch stays
 * server-side rather than being inlined into every visitor's bundle.
 *
 * Even switched on, a visitor sees rupees unless the practice has set a rate
 * for their currency. This decides whether the site asks, not what it says.
 */
export function localCurrencyEnabled(): boolean {
  return process.env.LOCAL_CURRENCY?.trim().toLowerCase() === "on";
}
