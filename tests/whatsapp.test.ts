import { describe, it, expect } from "vitest";
import { safeWhatsappLink, whatsappLinkProblem } from "@/lib/whatsapp";
import { siteContentSchema } from "@/lib/validation";
import { defaultContent, toPublicContent, mergeContent } from "@/lib/content";

/**
 * A serialised object with the published crisis helplines taken out of it.
 *
 * Those two numbers are meant to be published — they are the whole point of the
 * crisis card — so a guard reading "no number anywhere" would now fail on the
 * one kind of number that belongs there. Removing exactly the declared helplines
 * first makes the claim stricter than it was rather than weaker: the only
 * numbers this site publishes are the ones on that card, and any other number,
 * the practitioner's included, still fails every assertion below.
 */
function withoutHelplines(value: unknown): string {
  let serialised = JSON.stringify(value);
  for (const line of defaultContent.crisis.helplines) {
    serialised = serialised.split(line.number).join("<published-helpline>");
  }
  return serialised;
}

describe("a WhatsApp link that cannot be a phone number", () => {
  it("refuses wa.me/<number>, which is how the number leaked before", () => {
    expect(safeWhatsappLink("https://wa.me/919130743144")).toBe("");
    expect(
      safeWhatsappLink("https://wa.me/919130743144?text=Hi%20Priyanka")
    ).toBe("");
  });

  it("refuses a number hidden in a query string", () => {
    expect(
      safeWhatsappLink("https://api.whatsapp.com/send?phone=919130743144")
    ).toBe("");
  });

  it("refuses a bare number typed into the field", () => {
    expect(safeWhatsappLink("919130743144")).toBe("");
    expect(safeWhatsappLink("+91 91307 43144")).toBe("");
  });

  it("accepts a handle, with or without the @", () => {
    expect(safeWhatsappLink("samvriti")).toBe("https://wa.me/samvriti");
    expect(safeWhatsappLink("@samvriti")).toBe("https://wa.me/samvriti");
    expect(safeWhatsappLink("  samvriti.space  ")).toBe(
      "https://wa.me/samvriti.space"
    );
  });

  it("accepts a Business short link, which names no number", () => {
    for (const link of [
      "https://wa.me/message/ABC123XYZ",
      "https://wa.me/qr/AB12CD34",
    ]) {
      expect(safeWhatsappLink(link), link).toBe(link);
    }
  });

  it("refuses another host wearing a WhatsApp-looking path", () => {
    expect(safeWhatsappLink("https://evil.example/wa.me/samvriti")).toBe("");
    expect(safeWhatsappLink("https://notwa.me/samvriti")).toBe("");
  });

  it("refuses http, javascript: and nonsense", () => {
    for (const bad of [
      "http://wa.me/samvriti",
      "javascript:alert(1)",
      "not a url",
      "",
      "   ",
      null,
      undefined,
      42,
    ]) {
      expect(safeWhatsappLink(bad), String(bad)).toBe("");
    }
  });

  it("explains a refusal, and says so only when there is one", () => {
    expect(whatsappLinkProblem("")).toBe("");
    expect(whatsappLinkProblem("samvriti")).toBe("");
    expect(whatsappLinkProblem("https://wa.me/919130743144")).toMatch(
      /phone number/i
    );
    expect(whatsappLinkProblem("https://evil.example/x")).toMatch(/wa\.me/);
  });
});

describe("the schema and the shipped defaults", () => {
  it("stores a handle and drops a number", () => {
    const withNumber = siteContentSchema.parse({
      ...defaultContent,
      contact: {
        ...defaultContent.contact,
        whatsappLink: "https://wa.me/919130743144",
      },
    });
    expect(withNumber.contact.whatsappLink).toBe("");

    const withHandle = siteContentSchema.parse({
      ...defaultContent,
      contact: { ...defaultContent.contact, whatsappLink: "samvriti" },
    });
    expect(withHandle.contact.whatsappLink).toBe("https://wa.me/samvriti");
  });

  it("ships a handle and no number of its own", () => {
    /*
      The defaults used to ship no link at all. That read as the cautious choice
      until storage became unreadable and every visitor was served this object
      with the WhatsApp link missing — so the floor now carries the handle.

      What must never ship is a number, and the sanitiser is the authority on
      that: a value it returns unchanged has already been through the
      seven-digit check.
    */
    expect(safeWhatsappLink(defaultContent.contact.whatsappLink)).toBe(
      defaultContent.contact.whatsappLink
    );
    expect(defaultContent.contact.whatsappLink).not.toMatch(/\d{7,}/);
    expect(defaultContent.contact.phone).toBe("");
    // The crisis helplines are published on purpose; nothing else is.
    expect(withoutHelplines(defaultContent)).not.toMatch(/\+?9\d[\d\s-]{8,}/);
  });

  it("serves the handle to the browser, because a handle is not a number", () => {
    const shown = toPublicContent({
      ...defaultContent,
      contact: {
        ...defaultContent.contact,
        whatsappLink: "https://wa.me/samvriti",
      },
    });
    expect(shown.contact.whatsappLink).toBe("https://wa.me/samvriti");
    expect("phone" in shown.contact).toBe(false);
  });
});

describe("a number already in storage never reaches the page", () => {
  /*
    The regression this exists for. Validating on save protects nothing that was
    stored before the rule existed, and `contact` is merged one level deep — so
    a legacy wa.me/<number> survived the merge and, once the field was served
    publicly, went straight into an href on the live site.
  */
  const stored = {
    contact: {
      whatsappLink:
        "https://wa.me/919130743144?text=Hi%20Priyanka%2C%20I%27d%20like%20to%20book",
    },
  };

  it("drops a stored link carrying a number", () => {
    expect(mergeContent(stored).contact.whatsappLink).toBe("");
  });

  it("leaves no trace of it in what the browser receives", () => {
    const serialised = withoutHelplines(toPublicContent(mergeContent(stored)));
    expect(serialised).not.toContain("wa.me");
    // Not a bare \d{7,}: the LinkedIn profile URL legitimately ends in nine
    // digits, and an assertion that flags that is one nobody will trust.
    expect(serialised).not.toContain("919130743144");
    expect(serialised).not.toMatch(/(?:\+?91[\s-]?)?\d{5}[\s-]?\d{5}/);
  });

  it("still serves a stored handle, which names no number", () => {
    const merged = mergeContent({
      contact: { whatsappLink: "https://wa.me/samvriti.space" },
    });
    expect(merged.contact.whatsappLink).toBe("https://wa.me/samvriti.space");
  });

  it("keeps the rest of the stored contact details", () => {
    const merged = mergeContent({
      contact: { email: "someone@example.com", whatsappLink: "https://wa.me/919130743144" },
    });
    expect(merged.contact.email).toBe("someone@example.com");
    expect(merged.contact.whatsappLink).toBe("");
  });
});
