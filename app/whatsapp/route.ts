import { NextResponse } from "next/server";
import { getContent } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

/**
 * Redirect to WhatsApp, so the number never appears in the page.
 *
 * A wa.me link carries the phone number in the URL itself, which means linking
 * to it directly puts the number in the served HTML whether or not it is shown
 * as text — where address harvesters, which read hrefs rather than rendered
 * pages, will find it.
 *
 * Linking to this route instead leaves only "/whatsapp" in the markup. The
 * number is resolved server-side at the moment someone clicks, so a visitor
 * lands in the same conversation with the same prefilled message, while a
 * crawler that never follows the link never sees a number at all.
 *
 * Excluded from the sitemap and disallowed in robots.txt: it is a doorway, not
 * a page.
 */
export const revalidate = 60;

export async function GET() {
  const content = await getContent().catch(() => null);
  const target = content?.contact?.whatsappLink;

  if (!target) {
    // Nothing configured — send them to the contact section rather than
    // nowhere, so the click still lands somewhere useful.
    return NextResponse.redirect(`${SITE_URL}/#contact`, 302);
  }

  // 302 rather than 301: the destination is editable from the dashboard, and a
  // permanent redirect would be cached by browsers long after it changed.
  return NextResponse.redirect(target, 302);
}
