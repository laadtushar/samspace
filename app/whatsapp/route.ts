import { NextResponse } from "next/server";
import { publicContent } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

/**
 * A tombstone, not a feature.
 *
 * This route used to look up the practitioner's wa.me link and redirect to it,
 * which kept the number out of the markup but handed it to anyone who followed
 * the link. The number is gone now — from the defaults, from the schema, and
 * from the contact card.
 *
 * The route stays because a stored /start link may still point here, and a dead
 * link on the one page an Instagram bio points at is worse than a redirect. It
 * forwards to the configured handle, falling back to the shipped one and then
 * to the contact section — and it can no longer forward to a number, because
 * the schema will not store one and the defaults carry a handle, not a number.
 *
 * Resolved per request, not at build time. With `revalidate` the redirect target
 * was baked into the build as a response header, and a build renders before it
 * can read stored content — so a fresh deployment served the fallback, sending
 * people to the contact section while a perfectly good handle sat in the
 * dashboard, until the hour elapsed. A redirect whose destination is editable
 * copy cannot be frozen next to the code.
 *
 * This costs nothing at the meter: `publicContent` reads through the same hourly
 * cache and it still clears on save, so the handle is read as rarely as before
 * and a change to it takes effect at once instead of within the hour.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  /*
    publicContent, not a catch of its own. This used to fall back to null on a
    read failure and forward to the contact section — so when storage started
    refusing, it sent people to a page anchor although a perfectly good handle
    was sitting in the shipped defaults the rest of the site was already using.
    The floor is only a floor if everything stands on the same one.
  */
  const { contact } = await publicContent();
  // No handle configured at all, or a stored link the schema now refuses: send
  // them to the contact section rather than nowhere.
  return NextResponse.redirect(contact.whatsappLink || `${SITE_URL}/#contact`, 302);
}
