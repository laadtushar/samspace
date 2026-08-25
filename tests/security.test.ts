import { describe, it, expect, beforeEach, vi } from "vitest";
import { esc, escMultiline, escSubject } from "@/lib/email";
import {
  intakeSchema,
  contactSchema,
  safeExternalUrl,
  siteContentSchema,
  blogPostSchema,
} from "@/lib/validation";
import { rateLimit, isSameOrigin } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/auth";
import { defaultContent, toPublicContent } from "@/lib/content";
import { serializeJsonLd } from "@/lib/site";
import { safeProfileUrl, safeLinkHref } from "@/lib/validation";
import { splitStatements } from "../scripts/migrate.mjs";
import { encryptJson, decryptJson, isEncrypted } from "@/lib/crypto";

describe("email escaping", () => {
  it("neutralises markup a stranger typed into a name field", () => {
    const attack = '</strong><a href="https://evil.example">Click to confirm</a>';
    const rendered = esc(attack);
    expect(rendered).not.toContain("<a ");
    expect(rendered).not.toContain("</strong>");
    expect(rendered).toContain("&lt;");
  });

  it("escapes before turning newlines into breaks, not after", () => {
    const rendered = escMultiline("line one\n<img src=x onerror=alert(1)>");
    expect(rendered).toContain("<br/>");
    expect(rendered).not.toContain("<img");
    expect(rendered).toContain("&lt;img");
  });

  it("strips CR/LF from subjects so headers cannot be injected", () => {
    expect(escSubject("Hello\r\nBcc: victim@example.com")).toBe(
      "Hello Bcc: victim@example.com"
    );
  });

  it("renders null and undefined as empty rather than the words", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

describe("intake validation", () => {
  const valid = {
    name: "Test Person",
    email: "test@example.com",
    gender: "Female",
    age: "22",
    whatsapp: "9999999999",
    education: "BA Psychology",
    preferredLanguage: "English",
    concerns: "Exam stress.",
    slidingScale: "₹800",
    studentConfirmed: false,
    scheduling: "skipped" as const,
  };

  it("accepts a well-formed submission", () => {
    expect(intakeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-string concerns field instead of 500ing downstream", () => {
    const parsed = intakeSchema.safeParse({ ...valid, concerns: 12345 });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(intakeSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(
      false
    );
  });

  it("caps concerns length so storage cannot be flooded", () => {
    const parsed = intakeSchema.safeParse({
      ...valid,
      concerns: "x".repeat(5001),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an implausible age", () => {
    expect(intakeSchema.safeParse({ ...valid, age: "999" }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...valid, age: "7" }).success).toBe(false);
  });

  it("rejects a phone number that is not one", () => {
    expect(
      intakeSchema.safeParse({ ...valid, whatsapp: "call me maybe" }).success
    ).toBe(false);
  });

  it("defaults the optional fields rather than dropping them", () => {
    const parsed = intakeSchema.parse({
      name: "A",
      email: "a@b.co",
      gender: "Male",
      age: "30",
      whatsapp: "+91 91307 43144",
      concerns: "hello",
      slidingScale: "₹900",
    });
    expect(parsed.education).toBe("");
    expect(parsed.studentConfirmed).toBe(false);
    expect(parsed.scheduling).toBe("");
  });
});

describe("contact validation", () => {
  it("requires all three fields", () => {
    expect(contactSchema.safeParse({ name: "", email: "a@b.co", message: "hi" }).success).toBe(
      false
    );
  });

  it("caps message length", () => {
    expect(
      contactSchema.safeParse({
        name: "A",
        email: "a@b.co",
        message: "x".repeat(5001),
      }).success
    ).toBe(false);
  });
});

describe("safeExternalUrl", () => {
  it("strips a javascript: URL that would execute on click", () => {
    expect(safeExternalUrl("javascript:alert(document.cookie)")).toBe("");
  });

  it("rejects plain http", () => {
    expect(safeExternalUrl("http://wa.me/919130743144")).toBe("");
  });

  it("rejects a host outside the allowlist", () => {
    expect(safeExternalUrl("https://evil.example/x", ["wa.me"])).toBe("");
  });

  it("rejects a lookalike host that merely contains the allowed name", () => {
    expect(safeExternalUrl("https://wa.me.evil.example/x", ["wa.me"])).toBe("");
  });

  it("accepts an allowed host and its subdomains", () => {
    expect(safeExternalUrl("https://wa.me/919130743144", ["wa.me"])).toContain(
      "wa.me"
    );
    expect(
      safeExternalUrl("https://api.whatsapp.com/send", ["whatsapp.com"])
    ).toContain("whatsapp.com");
  });

  it("returns empty for junk rather than throwing", () => {
    expect(safeExternalUrl("not a url")).toBe("");
    expect(safeExternalUrl(null)).toBe("");
    expect(safeExternalUrl(42)).toBe("");
  });
});

describe("site content validation", () => {
  it("accepts the shipped defaults", () => {
    const parsed = siteContentSchema.safeParse(defaultContent);
    if (!parsed.success) console.error(parsed.error.issues);
    expect(parsed.success).toBe(true);
  });

  it("scrubs a javascript: whatsapp link on the way in", () => {
    const parsed = siteContentSchema.parse({
      ...defaultContent,
      contact: { ...defaultContent.contact, whatsappLink: "javascript:alert(1)" },
    });
    expect(parsed.contact.whatsappLink).toBe("");
  });

  it("scrubs a non-Calendly scheduling link", () => {
    const parsed = siteContentSchema.parse({
      ...defaultContent,
      calendlyUrl: "https://evil.example/book",
    });
    expect(parsed.calendlyUrl).toBe("");
  });

  it("keeps a real Calendly link", () => {
    const parsed = siteContentSchema.parse({
      ...defaultContent,
      calendlyUrl: "https://calendly.com/samvriti/50min",
    });
    expect(parsed.calendlyUrl).toContain("calendly.com");
  });
});

describe("blog post validation", () => {
  const valid = {
    slug: "why-exam-stress-peaks",
    title: "Why exam stress peaks",
    content: "Some words.",
    coverImage: "",
    status: "draft" as const,
  };

  it("accepts a well-formed post", () => {
    expect(blogPostSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a slug with a path traversal attempt", () => {
    expect(blogPostSchema.safeParse({ ...valid, slug: "../secrets" }).success).toBe(
      false
    );
    expect(blogPostSchema.safeParse({ ...valid, slug: "a/b" }).success).toBe(false);
  });

  it("rejects an uppercase or spaced slug", () => {
    expect(blogPostSchema.safeParse({ ...valid, slug: "My Post" }).success).toBe(
      false
    );
  });

  it("requires content", () => {
    expect(blogPostSchema.safeParse({ ...valid, content: "" }).success).toBe(false);
  });
});

describe("rate limiting", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    const blocked = rateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("keeps separate callers independent", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, opts).allowed).toBe(true);
    expect(rateLimit(a, opts).allowed).toBe(false);
    expect(rateLimit(b, opts).allowed).toBe(true);
  });
});

describe("same-origin check", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://samvritispace.com/api/contact", {
      method: "POST",
      headers,
    });

  it("accepts a matching origin", () => {
    expect(
      isSameOrigin(
        req({ origin: "https://samvritispace.com", host: "samvritispace.com" })
      )
    ).toBe(true);
  });

  it("rejects a cross-origin post", () => {
    expect(
      isSameOrigin(req({ origin: "https://evil.example", host: "samvritispace.com" }))
    ).toBe(false);
  });

  it("allows non-browser callers that send no Origin", () => {
    expect(isSameOrigin(req({ host: "samvritispace.com" }))).toBe(true);
  });
});

describe("constant-time comparison", () => {
  it("matches identical strings", () => {
    expect(safeEqual("correct horse battery staple", "correct horse battery staple")).toBe(
      true
    );
  });

  it("rejects a near miss", () => {
    expect(safeEqual("password123", "password124")).toBe(false);
  });

  it("rejects strings of different lengths without throwing", () => {
    expect(safeEqual("short", "considerably longer value")).toBe(false);
  });
});

describe("JSON-LD serialisation", () => {
  it("prevents a stored title from closing the script tag", () => {
    const out = serializeJsonLd({
      headline: "</script><script>alert(document.cookie)</script>",
    });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c");
  });

  it("stays valid JSON that parses back to the original value", () => {
    const title = "</script><img src=x onerror=alert(1)>";
    const parsed = JSON.parse(serializeJsonLd({ headline: title }));
    expect(parsed.headline).toBe(title);
  });

  it("does not mangle ordinary text", () => {
    const parsed = JSON.parse(serializeJsonLd({ a: "hello there — fine" }));
    expect(parsed.a).toBe("hello there — fine");
  });

  it("escapes the line separators that break inline scripts", () => {
    const out = serializeJsonLd({ a: "one two three" });
    expect(out).not.toContain(" ");
    expect(out).not.toContain(" ");
    expect(JSON.parse(out).a).toBe("one two three");
  });
});

describe("record encryption at rest", () => {
  const submission = {
    id: "abc",
    name: "Test Person",
    email: "test@example.com",
    whatsapp: "9999999999",
    concerns: "I have been struggling with panic attacks before exams.",
  };

  it("stores nothing readable — the plaintext does not survive", () => {
    const stored = encryptJson(submission);
    expect(stored).not.toContain("Test Person");
    expect(stored).not.toContain("test@example.com");
    expect(stored).not.toContain("panic attacks");
    expect(stored).not.toContain("9999999999");
  });

  it("round-trips exactly", () => {
    expect(decryptJson(encryptJson(submission))).toEqual(submission);
  });

  it("uses a fresh IV, so identical records differ on disk", () => {
    expect(encryptJson(submission)).not.toBe(encryptJson(submission));
  });

  it("refuses tampered ciphertext rather than returning altered data", () => {
    const stored = encryptJson(submission);
    const [prefix, iv, tag, data] = [
      stored.slice(0, 7),
      ...stored.slice(7).split("."),
    ];
    const flipped = data.slice(0, -2) + (data.slice(-2) === "AA" ? "BB" : "AA");
    expect(() => decryptJson(`${prefix}${iv}.${tag}.${flipped}`)).toThrow();
  });

  it("still reads records written before encryption existed", () => {
    expect(decryptJson(JSON.stringify(submission))).toEqual(submission);
  });

  it("marks its own payloads and does not claim plain JSON", () => {
    expect(isEncrypted(encryptJson(submission))).toBe(true);
    expect(isEncrypted(JSON.stringify(submission))).toBe(false);
  });
});

describe("intake field rules (client mirrors the server)", () => {
  // The form validates before submitting; the server validates regardless.
  // These assert the two agree, so a value accepted in the browser is not
  // rejected by the API — the round trip that used to say only "Failed".
  const cases: Array<[string, Record<string, unknown>, boolean]> = [
    ["a plausible age", { age: "24" }, true],
    ["age below the floor", { age: "9" }, false],
    ["age above the ceiling", { age: "150" }, false],
    ["a non-numeric age", { age: "twenty" }, false],
    ["an email without a domain", { email: "someone@" }, false],
    ["a normal email", { email: "someone@example.com" }, true],
    ["a phone with spaces and +", { whatsapp: "+91 91307 43144" }, true],
    ["a phone that is words", { whatsapp: "call me" }, false],
  ];

  const base = {
    name: "Test Person",
    email: "test@example.com",
    gender: "Female",
    age: "22",
    whatsapp: "9999999999",
    concerns: "Exam stress.",
    slidingScale: "₹800",
  };

  for (const [label, patch, shouldPass] of cases) {
    it(`${shouldPass ? "accepts" : "rejects"} ${label}`, () => {
      expect(intakeSchema.safeParse({ ...base, ...patch }).success).toBe(shouldPass);
    });
  }
});

describe("social profile links", () => {
  const hosts = ["instagram.com", "linkedin.com"];

  it("strips Instagram's share tracking", () => {
    expect(
      safeProfileUrl(
        "https://www.instagram.com/samvriti.space?igsh=YTdzZGI3MjZ5dTc1",
        hosts
      )
    ).toBe("https://www.instagram.com/samvriti.space");
  });

  it("strips LinkedIn's utm parameters", () => {
    expect(
      safeProfileUrl(
        "https://www.linkedin.com/in/priyanka-varma-322363216?utm_source=share_via&utm_content=profile&utm_medium=member_android",
        hosts
      )
    ).toBe("https://www.linkedin.com/in/priyanka-varma-322363216");
  });

  it("keeps the path — the profile is the path, not the query", () => {
    expect(safeProfileUrl("https://www.instagram.com/samvriti.space", hosts)).toBe(
      "https://www.instagram.com/samvriti.space"
    );
  });

  it("refuses a host that is not on the list", () => {
    expect(safeProfileUrl("https://evil.example/in/someone", hosts)).toBe("");
  });

  it("refuses a lookalike host", () => {
    expect(safeProfileUrl("https://instagram.com.evil.example/x", hosts)).toBe("");
  });

  it("refuses javascript: dressed as a profile", () => {
    expect(safeProfileUrl("javascript:alert(1)", hosts)).toBe("");
  });

  it("refuses plain http", () => {
    expect(safeProfileUrl("http://www.instagram.com/samvriti.space", hosts)).toBe("");
  });

  it("treats an empty value as simply unset", () => {
    expect(safeProfileUrl("", hosts)).toBe("");
    expect(safeProfileUrl(undefined, hosts)).toBe("");
  });
});

describe("contact details kept out of the browser", () => {
  // Anything passed to a client component is serialised into the page, so a
  // field that is merely "not rendered" is still published. These assert the
  // number never reaches the payload at all.
  const publicContent = toPublicContent(defaultContent);

  it("drops the phone number", () => {
    expect("phone" in publicContent.contact).toBe(false);
  });

  it("drops the wa.me link, which contains the number in its URL", () => {
    expect("whatsappLink" in publicContent.contact).toBe(false);
  });

  it("leaves no trace of the number anywhere in the serialised object", () => {
    const serialised = JSON.stringify(publicContent);
    const digits = defaultContent.contact.phone.replace(/\D/g, "");
    expect(serialised).not.toContain(digits);
    expect(serialised).not.toContain("wa.me");
  });

  it("keeps the parts the page actually needs", () => {
    expect(publicContent.contact.email).toBe(defaultContent.contact.email);
    expect(publicContent.contact.heading).toBeTruthy();
    expect(publicContent.faq.items.length).toBeGreaterThan(0);
  });
});

describe("/start link targets", () => {
  // These render as anchors from dashboard input, so a hostile value pasted in
  // would run for every visitor who taps it.
  it("allows a path on this site", () => {
    expect(safeLinkHref("/?intake=true")).toBe("/?intake=true");
    expect(safeLinkHref("/blog")).toBe("/blog");
    expect(safeLinkHref("/#about")).toBe("/#about");
  });

  it("allows an https link", () => {
    expect(safeLinkHref("https://calendly.com/x/50min")).toBe(
      "https://calendly.com/x/50min"
    );
  });

  it("refuses javascript:", () => {
    expect(safeLinkHref("javascript:alert(document.cookie)")).toBe("");
  });

  it("refuses data: and vbscript:", () => {
    expect(safeLinkHref("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(safeLinkHref("vbscript:msgbox(1)")).toBe("");
  });

  it("refuses protocol-relative, which looks internal but is not", () => {
    expect(safeLinkHref("//evil.example/pwned")).toBe("");
  });

  it("refuses plain http", () => {
    expect(safeLinkHref("http://example.com")).toBe("");
  });

  it("treats blank as unset", () => {
    expect(safeLinkHref("")).toBe("");
    expect(safeLinkHref(null)).toBe("");
  });
});

describe("startPage links survive the real save path", () => {
  // safeLinkHref is unit-tested above; this asserts the schema actually applies
  // it, so a hostile value cannot reach storage through the content endpoint.
  const save = (href: string) =>
    siteContentSchema.parse({
      ...defaultContent,
      startPage: {
        heading: "Start here",
        subtext: "Intro",
        links: [{ label: "Tap me", description: "d", href }],
      },
    }).startPage.links[0].href;

  it("strips javascript: while keeping the button", () => {
    expect(save("javascript:alert(document.cookie)")).toBe("");
  });

  it("strips protocol-relative links", () => {
    expect(save("//evil.example/x")).toBe("");
  });

  it("keeps an internal path", () => {
    expect(save("/?intake=true")).toBe("/?intake=true");
  });

  it("keeps an https link", () => {
    expect(save("https://calendly.com/x")).toBe("https://calendly.com/x");
  });

  it("caps the number of buttons", () => {
    expect(() =>
      siteContentSchema.parse({
        ...defaultContent,
        startPage: {
          heading: "h",
          subtext: "s",
          links: Array.from({ length: 11 }, () => ({
            label: "x",
            description: "d",
            href: "/blog",
          })),
        },
      })
    ).toThrow();
  });
});

describe("migration statement splitting", () => {
  // A migration is sent one statement at a time over HTTP, so the file has to
  // be split correctly. Cutting a dollar-quoted body in half would apply a
  // fragment of a function definition to a live database.
  it("splits ordinary statements", () => {
    expect(
      splitStatements("create table a (i int); create table b (i int);")
    ).toHaveLength(2);
  });

  it("ignores semicolons inside quoted strings", () => {
    const out = splitStatements("insert into t values ('a;b'); select 1;");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("'a;b'");
  });

  it("keeps a dollar-quoted body intact", () => {
    const out = splitStatements(
      "create function f() returns void as $$ begin raise notice 'x;y'; end $$ language plpgsql; select 1;"
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("raise notice 'x;y'");
  });

  it("does not treat a semicolon in a comment as a boundary", () => {
    expect(splitStatements("-- a; comment\nselect 1;")).toHaveLength(1);
  });

  it("splits the real migration into runnable statements", async () => {
    const { readFileSync } = await import("fs");
    const out = splitStatements(
      readFileSync("db/migrations/001_practice.sql", "utf8")
    );
    expect(out.filter((s) => /create table/i.test(s))).toHaveLength(3);
    expect(out.every((s) => s.trim().length > 0)).toBe(true);
  });

  it("the migration is additive — nothing drops or truncates", async () => {
    const { readFileSync } = await import("fs");
    const text = readFileSync("db/migrations/001_practice.sql", "utf8");
    expect(text).not.toMatch(/\bdrop\s+(table|column|database|index)\b/i);
    expect(text).not.toMatch(/\btruncate\b/i);
    expect(text).not.toMatch(/\bdelete\s+from\b/i);
  });
});

/**
 * Every route under /api/admin has to check who is asking.
 *
 * There is no middleware doing it centrally, so the check lives in each route —
 * which means a new route ships unprotected the day someone forgets. This walks
 * the directory rather than a list, so a file added later is covered without
 * anyone remembering to add it here.
 */
describe("admin routes are guarded", () => {
  /**
   * The three ways in, which cannot require a session because the caller does
   * not have one yet. Everything else must.
   */
  const PUBLIC_BY_DESIGN = [
    "app/api/admin/auth/route.ts",
    "app/api/admin/auth/verify/route.ts",
    "app/api/admin/invite/route.ts",
  ];

  const routeFiles = (dir: string): string[] => {
    const { readdirSync, statSync } = require("fs") as typeof import("fs");
    return readdirSync(dir).flatMap((entry: string) => {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) return routeFiles(full);
      return entry === "route.ts" ? [full] : [];
    });
  };

  it("checks the caller in every handler it exports", async () => {
    const { readFileSync } = await import("fs");
    const files = routeFiles("app/api/admin");
    expect(files.length).toBeGreaterThan(5);

    for (const file of files) {
      if (PUBLIC_BY_DESIGN.includes(file)) continue;
      const source = readFileSync(file, "utf8");
      const handlers =
        source.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) ?? [];
      const guards =
        source.match(/\b(requireAdmin|adminOrDenied|ownerOrDenied)\(\)/g) ?? [];

      expect(handlers.length, `${file} exports no handlers`).toBeGreaterThan(0);
      expect(
        guards.length,
        `${file} has ${handlers.length} handlers but only ${guards.length} guard calls`
      ).toBeGreaterThanOrEqual(handlers.length);
    }
  });

  it("always awaits the guard, since it reads the session from the database", async () => {
    const { readFileSync } = await import("fs");
    for (const file of routeFiles("app/api/admin")) {
      const source = readFileSync(file, "utf8");
      // `requireAdmin()` without await returns a Promise, which is truthy —
      // it would refuse every request rather than allowing them, but the
      // sibling helpers destructure and would throw. Either way it is a bug.
      expect(source, `${file} calls a guard without awaiting it`).not.toMatch(
        /(?<!await\s)\b(requireAdmin|adminOrDenied|ownerOrDenied)\(\)/
      );
    }
  });
});

describe("the admin accounts migration", () => {
  it("is additive — nothing drops or truncates", async () => {
    const { readFileSync } = await import("fs");
    const text = readFileSync("db/migrations/003_admin_users.sql", "utf8");
    expect(text).not.toMatch(/\bdrop\s+(table|column|database|index)\b/i);
    expect(text).not.toMatch(/\btruncate\b/i);
    expect(text).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("creates the four tables the login flow needs", async () => {
    const { readFileSync } = await import("fs");
    const out = splitStatements(readFileSync("db/migrations/003_admin_users.sql", "utf8"));
    const tables = out.filter((s) => /create table/i.test(s));
    expect(tables).toHaveLength(4);
    // Every one of them is safe to run twice.
    expect(tables.every((s) => /create table if not exists/i.test(s))).toBe(true);
  });
});

/**
 * The Google Business Profile link in the structured data.
 *
 * Google's share URL carries tokens identifying whoever pressed share. The
 * codebase already strips that class of parameter from Instagram and LinkedIn
 * profiles; this pins the same rule for the listing, which is easy to undo by
 * pasting a fresh share link over it.
 */
describe("the Business Profile reference", () => {
  const layout = () => {
    const { readFileSync } = require("fs") as typeof import("fs");
    return readFileSync("app/layout.tsx", "utf8");
  };

  it("is present in the business structured data", () => {
    expect(layout()).toContain("kgmid=/g/11zwyw0x4j");
  });

  it("carries no share-tracking parameters", () => {
    const source = layout();
    const link = source.match(/"(https:\/\/www\.google\.com\/search\?[^"]*)"/)?.[1] ?? "";
    expect(link).toBeTruthy();
    for (const param of ["utm_source", "shem", "shndl", "kgs", "source=", "&hl="]) {
      expect(link, `share tracking leaked: ${param}`).not.toContain(param);
    }
  });

  it("hangs off the business rather than the person", () => {
    // The listing is the practice, not Priyanka's personal profile.
    const source = layout();
    const businessBlock = source.slice(
      source.indexOf('"@type": ["ProfessionalService"'),
      source.indexOf('"@type": "Person"')
    );
    expect(businessBlock).toContain("GOOGLE_BUSINESS_PROFILE");
    expect(source.slice(source.indexOf('"@type": "Person"'))).not.toContain(
      "GOOGLE_BUSINESS_PROFILE"
    );
  });
});

/**
 * The sliding scale is quoted in six places that nothing links together.
 *
 * The student rate lives in the content defaults, in the intake form's
 * fallback, in the search description, in the social card, in the structured
 * data's priceRange and minPrice, and in every blog post's closing line. When
 * the rate changed from ₹500 to ₹600 each of those had to be found by hand.
 * These tests fail the next time one of them is missed, which is the only
 * mechanism that catches a stale price before a reader does.
 */
describe("the sliding scale is quoted consistently", () => {
  const read = async (path: string) => {
    const { readFileSync } = await import("fs");
    return readFileSync(path, "utf8");
  };

  /** The lowest rate, taken from the content defaults rather than hardcoded. */
  const lowestRate = async () => {
    const { defaultContent } = await import("@/lib/content");
    const first = defaultContent.slidingScale[0];
    const amount = first.match(/₹(\d+)/)?.[1];
    expect(amount, `could not read a rate from "${first}"`).toBeTruthy();
    return Number(amount);
  };

  it("marks the cheapest rate as the student one", async () => {
    const { defaultContent } = await import("@/lib/content");
    const amounts = defaultContent.slidingScale.map((r) =>
      Number(r.match(/₹(\d+)/)?.[1] ?? 0)
    );
    expect(defaultContent.slidingScale[0]).toContain("(Student)");
    expect(Math.min(...amounts)).toBe(amounts[0]);
  });

  it("uses the same lowest rate in the structured data", async () => {
    const layout = await read("app/layout.tsx");
    const low = await lowestRate();
    expect(layout).toContain(`minPrice: ${low}`);
    expect(layout).toContain(`priceRange: "₹${low}–₹1000"`);
  });

  it("uses the same lowest rate in the search and social descriptions", async () => {
    const layout = await read("app/layout.tsx");
    const low = await lowestRate();
    // The OG description, the Twitter description and priceRange all quote it.
    const quoted = layout.match(/₹\d+–₹1000/g) ?? [];
    expect(quoted.length).toBeGreaterThanOrEqual(3);
    for (const q of quoted) expect(q).toBe(`₹${low}–₹1000`);
  });

  it("uses the same lowest rate in the services card and the FAQ answer", async () => {
    const content = await read("lib/content.ts");
    const low = await lowestRate();
    for (const q of content.match(/₹\d+–₹1000/g) ?? []) {
      expect(q).toBe(`₹${low}–₹1000`);
    }
    // The FAQ explains which rate is the student one by naming the amount.
    expect(content).toContain(`The ₹${low} rate is reserved for students`);
  });

  it("uses the same lowest rate in every shipped post", async () => {
    const { STARTER_POSTS } = await import("@/lib/starter-posts");
    const low = await lowestRate();
    for (const post of STARTER_POSTS) {
      const quoted = post.content.match(/₹\d+–₹1000/g) ?? [];
      expect(quoted.length, `${post.slug} never quotes the rate`).toBeGreaterThan(0);
      for (const q of quoted) expect(q, post.slug).toBe(`₹${low}–₹1000`);
    }
  });

  it("uses the same lowest rate in the intake form's fallback", async () => {
    const form = await read("components/IntakeFormModal.tsx");
    const low = await lowestRate();
    for (const q of form.match(/₹\d+ \(Student\)/g) ?? []) {
      expect(q).toBe(`₹${low} (Student)`);
    }
  });
});
