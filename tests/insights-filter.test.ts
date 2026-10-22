import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { withoutPreviews } from "@/lib/insights-filter";
import { previewPath } from "@/lib/preview-links";

const origin = "https://www.samvritispace.com";
const event = (path: string) => ({ type: "pageview" as const, url: `${origin}${path}` });

describe("withoutPreviews", () => {
  it("drops a shared preview link, so its token never leaves the browser", () => {
    const path = previewPath("0b6f7c1e-2a4d-4e8f-9c3b-5d7a1e2f4b6c", "x".repeat(43));
    expect(withoutPreviews(event(path))).toBeNull();
  });

  it("drops the admin previews and /preview itself", () => {
    expect(withoutPreviews(event("/preview/page/therapy-for-indians-abroad"))).toBeNull();
    expect(withoutPreviews(event("/preview/blog/homesickness"))).toBeNull();
    expect(withoutPreviews(event("/preview"))).toBeNull();
  });

  it("keeps every other page, including ones whose name starts the same way", () => {
    for (const path of ["/", "/blog/homesickness", "/about", "/previews-of-therapy"]) {
      const e = event(path);
      expect(withoutPreviews(e)).toBe(e);
    }
  });

  it("drops an event whose address cannot be read", () => {
    expect(withoutPreviews({ url: "not a url" })).toBeNull();
  });
});

describe("root layout", () => {
  it("mounts Vercel's scripts only through the filtered wrapper", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toContain("<VercelInsights />");
    expect(layout).not.toMatch(/@vercel\/(analytics|speed-insights)/);
  });
});
