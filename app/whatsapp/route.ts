import { NextResponse } from "next/server";
import { getCachedContent } from "@/lib/content";
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
 * forwards to the configured handle, or to the contact section when there is
 * none — and it can no longer forward to a number, because the schema will not
 * store one. Cached for an hour: it is a doorway, and blob reads are metered.
 */
export const revalidate = 3600;

export async function GET() {
  const content = await getCachedContent().catch(() => null);
  const target = content?.contact?.whatsappLink;
  // No handle configured, or a stored link the schema now refuses: send them to
  // the contact section rather than nowhere.
  return NextResponse.redirect(target || `${SITE_URL}/#contact`, 302);
}
