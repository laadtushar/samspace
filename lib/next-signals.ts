/**
 * Whether an error is Next's own control flow rather than something failing.
 *
 * `notFound()`, `redirect()`, and reading a dynamic value while a page is being
 * prerendered all report themselves by throwing. Next marks its own by a string
 * `digest` — "NEXT_NOT_FOUND", "NEXT_REDIRECT;…", "DYNAMIC_SERVER_USAGE" — and
 * nothing thrown by a storage client or a database driver carries one.
 *
 * This is not a tidiness concern. A catch-all that absorbs these does not
 * degrade gracefully; it changes what the page is. Swallowing
 * DYNAMIC_SERVER_USAGE during a build is the difference between a route Next
 * serves dynamically and a route it prerenders — and what gets prerendered is
 * the fallback, frozen into the deployment until the next one.
 *
 * That is not hypothetical: it is what put the shipped defaults on the live
 * homepage and /start, with an empty booking link and an empty WhatsApp link,
 * for every visitor.
 *
 * Checked by shape rather than by importing Next's `isDynamicServerError`,
 * which lives at next/dist/client/components/hooks-server-context — an internal
 * path with no compatibility promise. The shape covers every signal, not only
 * the dynamic one, and a fallback must never eat any of them.
 */
export function isNextSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string"
  );
}
