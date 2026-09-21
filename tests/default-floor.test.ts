import { describe, it, expect } from "vitest";
import { defaultContent } from "@/lib/default-content";
import { providerFor } from "@/lib/scheduling";
import { safeWhatsappLink } from "@/lib/whatsapp";
import { siteContentSchema } from "@/lib/validation";

/**
 * The shipped defaults have to work, not merely exist.
 *
 * They are what every visitor is served whenever stored content cannot be read,
 * and that happened: the blob store started answering 403 and the live site
 * served this object to everyone. It had an empty booking link and an empty
 * WhatsApp handle, so the intake form lost its scheduling step and /whatsapp
 * redirected to the homepage — on the one page the practice exists to be found
 * through.
 *
 * So the floor is asserted to be a usable site rather than a shape that
 * typechecks.
 */
describe("the shipped defaults are a working site", () => {
  it("offers a booking link a provider recognises", () => {
    // providerFor is what decides whether the scheduling step exists at all, so
    // this is the same question the intake form asks.
    expect(providerFor(defaultContent.calendlyUrl)).not.toBeNull();
  });

  it("offers a WhatsApp link the redirect will accept", () => {
    expect(safeWhatsappLink(defaultContent.contact.whatsappLink)).toBe(
      defaultContent.contact.whatsappLink
    );
  });

  it("keeps the private number out, even here", () => {
    /*
      The one field that must stay empty. It is stripped from anything handed to
      the browser, but a default would put it into the HTML of every page the
      moment stored content stopped being readable.
    */
    expect(defaultContent.contact.phone).toBe("");
  });

  it("survives its own validation unchanged", () => {
    // The dashboard's schema rejects a booking host it does not know and blanks
    // the field. A default that failed that check would be worse than empty:
    // present in the file, absent in practice.
    const parsed = siteContentSchema.parse(defaultContent);
    expect(parsed.calendlyUrl).toBe(defaultContent.calendlyUrl);
    expect(parsed.contact.whatsappLink).toBe(
      defaultContent.contact.whatsappLink
    );
  });

  it("quotes a reachable way to get help and a price", () => {
    expect(defaultContent.crisis.helplines.length).toBeGreaterThan(0);
    expect(defaultContent.slidingScale.length).toBeGreaterThan(0);
    expect(defaultContent.contact.email).toContain("@");
  });
});
