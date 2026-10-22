import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pageTitle, TITLE_SUFFIX, TITLE_MAX_LENGTH, SITE_NAME, SITE_ALTERNATE_NAMES } from "@/lib/site";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("page titles in search results", () => {
  it("keeps the site suffix while the whole title fits", () => {
    const short = "Writing on therapy, anxiety & student life";
    expect(short.length + TITLE_SUFFIX.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
    expect(pageTitle(short)).toBe(short);
  });

  it("drops the suffix, not the words people search for, when it would not fit", () => {
    const long = "Avoidant Attachment Style: Signs, Causes and What Helps";
    expect(pageTitle(long)).toEqual({ absolute: long });
  });

  it("measures the suffix the template actually appends", () => {
    expect(TITLE_SUFFIX).toBe(` | ${SITE_NAME}`);
    expect(read("app/layout.tsx")).toContain("template: `%s${TITLE_SUFFIX}`");
  });

  it("uses it for the pages whose titles run long", () => {
    expect(read("app/blog/[slug]/page.tsx")).toContain("title: pageTitle(title)");
    expect(read("app/about/page.tsx")).toContain("title: pageTitle(");
  });
});

describe("structured data for who the practice serves", () => {
  const layout = read("app/layout.tsx");

  it("names the brand the way people type it", () => {
    expect(SITE_ALTERNATE_NAMES).toContain("Samvriti Space");
    expect(layout.match(/alternateName: SITE_ALTERNATE_NAMES/g)?.length).toBe(2);
  });

  it("serves India and Indians abroad, not India alone", () => {
    expect(layout).toContain('areaServed: [{ "@type": "Country", name: "India" }, "Worldwide"]');
  });
});
