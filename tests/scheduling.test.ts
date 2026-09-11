import { describe, it, expect } from "vitest";
import {
  SCHEDULING_PROVIDERS,
  SCHEDULING_HOSTS,
  providerFor,
  embedUrlFor,
  isBookingConfirmation,
} from "@/lib/scheduling";
import { siteContentSchema } from "@/lib/validation";
import { defaultContent } from "@/lib/content";

const CALENDLY = "https://calendly.com/samvriti/therapy-session";
const CALID = "https://cal.id/samvriti.space/therapy-session";

describe("recognising a booking link", () => {
  it("knows both providers by their own link", () => {
    expect(providerFor(CALENDLY)?.id).toBe("calendly");
    expect(providerFor(CALID)?.id).toBe("calid");
  });

  it("accepts a subdomain, which is how a team link is shaped", () => {
    expect(providerFor("https://team.calendly.com/x/y")?.id).toBe("calendly");
    expect(providerFor("https://app.cal.id/x/y")?.id).toBe("calid");
  });

  it("refuses everything else, and says so the same way each time", () => {
    for (const bad of [
      "",
      "   ",
      "not a url",
      "https://evil.example/book",
      // A host that merely ends with the letters is not the host.
      "https://notcalendly.com/x",
      "https://evilcal.id/x",
      // http would be framed over a plain connection.
      "http://calendly.com/x",
      "javascript:alert(1)",
      null,
      undefined,
      42,
    ]) {
      expect(providerFor(bad), String(bad)).toBeNull();
    }
  });
});

describe("making a link embeddable", () => {
  it("tells Calendly which domain is framing it, or it refuses to load", () => {
    const url = new URL(embedUrlFor(CALENDLY, "samvritispace.com"));
    expect(url.searchParams.get("embed_domain")).toBe("samvritispace.com");
    expect(url.searchParams.get("embed_type")).toBe("Inline");
    expect(url.searchParams.get("hide_gdpr_banner")).toBe("1");
  });

  it("tells Cal ID it is being embedded, which is what makes it emit events", () => {
    const url = new URL(embedUrlFor(CALID, "samvritispace.com"));
    expect(url.searchParams.get("embed")).toBe("inline");
    expect(url.searchParams.get("layout")).toBe("month_view");
  });

  it("keeps the path and any parameters already on the link", () => {
    const withQuery = `${CALID}?name=Asha&month=2026-09`;
    const url = new URL(embedUrlFor(withQuery, "samvritispace.com"));
    expect(url.pathname).toBe("/samvriti.space/therapy-session");
    expect(url.searchParams.get("name")).toBe("Asha");
    expect(url.searchParams.get("month")).toBe("2026-09");
  });

  it("returns nothing for a link it would not recognise", () => {
    expect(embedUrlFor("https://evil.example/book", "samvritispace.com")).toBe("");
    expect(embedUrlFor("", "samvritispace.com")).toBe("");
  });
});

describe("hearing that a slot was booked", () => {
  it("accepts each provider's own confirmation", () => {
    expect(
      isBookingConfirmation(CALENDLY, "https://calendly.com", {
        event: "calendly.event_scheduled",
      })
    ).toBe(true);

    expect(
      isBookingConfirmation(CALID, "https://cal.id", {
        originator: "CAL",
        type: "bookingSuccessful",
      })
    ).toBe(true);
  });

  it("accepts the newer Cal event that supersedes the old one", () => {
    expect(
      isBookingConfirmation(CALID, "https://cal.id", {
        originator: "CAL",
        type: "bookingSuccessfulV2",
      })
    ).toBe(true);
  });

  it("ignores a message from anywhere but the configured provider", () => {
    // The whole point of checking the origin: any page can postMessage.
    expect(
      isBookingConfirmation(CALENDLY, "https://evil.example", {
        event: "calendly.event_scheduled",
      })
    ).toBe(false);

    // A real provider, but not the one this link belongs to.
    expect(
      isBookingConfirmation(CALENDLY, "https://cal.id", {
        originator: "CAL",
        type: "bookingSuccessful",
      })
    ).toBe(false);

    // A lookalike host.
    expect(
      isBookingConfirmation(CALENDLY, "https://notcalendly.com", {
        event: "calendly.event_scheduled",
      })
    ).toBe(false);
  });

  it("ignores the provider's other chatter", () => {
    for (const data of [
      { event: "calendly.profile_page_viewed" },
      { event: "calendly.date_and_time_selected" },
      null,
      undefined,
      "booked",
      { originator: "CAL", type: "linkReady" },
      { originator: "NOT_CAL", type: "bookingSuccessful" },
      { type: "bookingSuccessful" },
    ]) {
      expect(
        isBookingConfirmation(CALENDLY, "https://calendly.com", data),
        JSON.stringify(data)
      ).toBe(false);
    }
    expect(
      isBookingConfirmation(CALID, "https://cal.id", { originator: "CAL", type: "linkReady" })
    ).toBe(false);
  });

  it("stays quiet when no link is configured at all", () => {
    expect(
      isBookingConfirmation("", "https://calendly.com", {
        event: "calendly.event_scheduled",
      })
    ).toBe(false);
  });

  it("refuses an origin that is not https", () => {
    expect(
      isBookingConfirmation(CALENDLY, "http://calendly.com", {
        event: "calendly.event_scheduled",
      })
    ).toBe(false);
  });
});

describe("the schema and the form agree on what is allowed", () => {
  const save = (calendlyUrl: string) =>
    siteContentSchema.parse({ ...defaultContent, calendlyUrl }).calendlyUrl;

  it("stores a link from either provider", () => {
    expect(save(CALENDLY)).toBe(CALENDLY);
    expect(save(CALID)).toBe(CALID);
  });

  it("stores nothing for a host neither provider claims", () => {
    expect(save("https://evil.example/book")).toBe("");
  });

  it("only ever stores links the form would then show", () => {
    // A link the dashboard accepts but the form refuses is the worst outcome:
    // a green dot in settings and no booking step on the site.
    for (const link of [CALENDLY, CALID, "https://evil.example/book", "nonsense"]) {
      const stored = save(link);
      expect(Boolean(stored), link).toBe(providerFor(stored) !== null);
    }
  });

  it("lists every provider's hosts for the allowlist", () => {
    for (const provider of SCHEDULING_PROVIDERS) {
      for (const host of provider.hosts) {
        expect(SCHEDULING_HOSTS).toContain(host);
      }
    }
  });
});
