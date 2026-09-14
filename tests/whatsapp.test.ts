import { describe, it, expect } from "vitest";
import { safeWhatsappLink, whatsappLinkProblem } from "@/lib/whatsapp";
import { siteContentSchema } from "@/lib/validation";
import { defaultContent, toPublicContent } from "@/lib/content";

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

  it("ships no WhatsApp link and no number of its own", () => {
    expect(defaultContent.contact.whatsappLink).toBe("");
    expect(defaultContent.contact.phone).toBe("");
    expect(JSON.stringify(defaultContent)).not.toMatch(/\+?9\d[\d\s-]{8,}/);
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
