/**
 * The strip that says a page is not public.
 *
 * Fixed to the bottom of the screen rather than the top, where the navbar is
 * already fixed, so neither can cover the other — and so it stays in view the
 * whole way down a long draft. Someone reading a preview must not be able to
 * mistake it for the live site, least of all in a screenshot.
 *
 * Server component: plain text, nothing to hydrate.
 */
export default function PreviewBanner({
  mode,
  status,
  expiresAt,
}: {
  /** "admin" for a signed-in preview, "link" for a shared one. */
  mode: "admin" | "link";
  status: "draft" | "published";
  /** For a shared link: when it stops working. */
  expiresAt?: string;
}) {
  const until = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "";

  const headline =
    mode === "admin"
      ? status === "draft"
        ? "Draft — only admins can see this"
        : "Admin preview — this is already published"
      : "Preview — not published";

  const detail =
    mode === "admin"
      ? status === "draft"
        ? "Visitors get a page-not-found here until it is published."
        : "This is what visitors see."
      : `Shared for review. Please don't pass this link on${until ? ` — it stops working on ${until}` : ""}.`;

  return (
    <div
      role="status"
      data-preview-banner={mode}
      className="fixed bottom-0 inset-x-0 z-[60] bg-clay text-cream shadow-[0_-4px_16px_rgba(0,0,0,0.15)]"
    >
      <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center">
        <strong className="font-sans text-sm font-semibold">{headline}</strong>
        <span className="font-sans text-xs text-cream/85">{detail}</span>
      </div>
    </div>
  );
}
