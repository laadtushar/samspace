import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { BRAND, shareImage } from "@/lib/brand";
import manifest from "@/app/manifest";
import { emailLogo } from "@/lib/email";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const pub = (src: string) => path.join(root, "public", src);

describe("brand assets", () => {
  it("serves every file lib/brand.ts points at", () => {
    const files = [BRAND.lockup.src, BRAND.lockupReversed.src, BRAND.emailLogo.src, BRAND.logo512, ...BRAND.manifestIcons.map((i) => i.src)];
    for (const f of files) {
      expect(existsSync(pub(f)), f).toBe(true);
      expect(statSync(pub(f)).size, f).toBeGreaterThan(0);
    }
  });

  it("keeps the public copies identical to the kit masters", () => {
    const pairs: [string, string][] = [
      ["public/brand/lockup-horizontal-color.svg", "brand/kit/logo/svg/lockup-horizontal-color.svg"],
      ["public/brand/lockup-horizontal-reversed.svg", "brand/kit/logo/svg/lockup-horizontal-reversed.svg"],
      ["app/icon.svg", "brand/kit/favicon/favicon.svg"],
    ];
    for (const [a, b] of pairs) expect(read(a), a).toBe(read(b));
  });

  it("records each lockup's real proportions", () => {
    for (const asset of [BRAND.lockup, BRAND.lockupReversed]) {
      const vb = read(path.join("public", asset.src)).match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      expect(vb, asset.src).not.toBeNull();
      expect(Number(vb![1])).toBe(asset.width);
      expect(Number(vb![2])).toBe(asset.height);
    }
  });

  it("no longer ships the leaf", () => {
    expect(read("app/icon.svg")).not.toMatch(/leaf/i);
    expect(existsSync(path.join(root, "app/opengraph-image.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "app/twitter-image.tsx"))).toBe(false);
    for (const f of ["app/favicon.ico", "app/apple-icon.png", "app/opengraph-image.png", "app/twitter-image.png"]) {
      expect(existsSync(path.join(root, f)), f).toBe(true);
    }
  });

  it("lists PNG and maskable icons in the manifest", () => {
    const icons = manifest().icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  });

  it("uses the logo, not typed text, wherever the name was set as a wordmark", () => {
    for (const f of ["components/Navbar.tsx", "components/Footer.tsx", "components/StartPage.tsx", "app/admin/page.tsx"]) {
      expect(read(f), f).toMatch(/BRAND\.lockup/);
    }
    for (const f of ["app/api/contact/route.ts", "app/api/intake/route.ts"]) {
      expect(read(f), f).toContain("${emailLogo()}");
      expect(read(f), f).not.toMatch(/<h1[^>]*>Samvriti\.Space<\/h1>/);
    }
  });

  it("gives pages that set their own openGraph the brand preview image", () => {
    for (const f of ["app/about/page.tsx", "app/blog/page.tsx"]) {
      expect(read(f), f).toContain("BRAND.ogImage");
    }
    const png = readFileSync(path.join(root, "app/opengraph-image.png"));
    expect(png.readUInt32BE(16)).toBe(BRAND.ogImage.width);
    expect(png.readUInt32BE(20)).toBe(BRAND.ogImage.height);
  });

  it("puts an absolute PNG logo with alt text at the top of client email", () => {
    const html = emailLogo();
    expect(html).toMatch(/src="https?:\/\/[^"]+\/brand\/email-logo\.png"/);
    expect(html).toContain('width="240"');
    expect(html).toContain('height="53"');
    expect(html).toContain('alt="Samvriti.Space"');
  });

  it("follows the kit's minimum size and colour rules wherever the lockup is shown", () => {
    // brand/kit/README.md: a horizontal lockup is at least 120px wide on screen,
    // and is never recoloured (opacity tints it against the ground).
    const ratio = BRAND.lockup.width / BRAND.lockup.height;
    const files = ["components/Navbar.tsx", "components/Footer.tsx", "components/StartPage.tsx", "app/admin/page.tsx"];
    for (const f of files) {
      const blocks = read(f).split("<Image").slice(1).filter((b) => /src=\{BRAND\.lockup/.test(b.slice(0, 120)));
      expect(blocks.length, f).toBeGreaterThan(0);
      for (const b of blocks) {
        const cls = b.match(/className="([^"]+)"/)![1];
        const h = Number(cls.match(/\bh-(\d+)\b/)![1]) * 4; // Tailwind: h-N is N/4 rem = N*4px
        expect(h * ratio, `${f}: ${cls}`).toBeGreaterThanOrEqual(120);
        expect(cls, f).not.toMatch(/opacity-/);
      }
    }
  });

  it("makes the navbar logo a real link home with a descriptive name", () => {
    const nav = read("components/Navbar.tsx");
    expect(nav).toMatch(/<Link\s+href="\/"\s+aria-label=\{`\$\{BRAND\.alt\} home`\}/);
  });

  it("draws icons from the icon set, not emoji, in site code", () => {
    // Emoji render differently on every platform and clash with the line-drawn
    // mark. Plain typographic symbols (✓, ✕) are fine. Content editors can
    // still type emoji into dashboard text; this only covers what the code ships.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u;
    const offenders: string[] = [];
    for (const dir of ["components", "app"]) {
      const walk = (d: string): string[] =>
        readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".tsx") ? [path.join(d, e.name)] : []
        );
      for (const f of walk(dir)) {
        read(f).split("\n").forEach((line, i) => {
          if (emoji.test(line)) offenders.push(`${f}:${i + 1}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never offers an SVG cover as a link preview", () => {
    expect(shareImage("/blog/cover.svg")).toEqual(BRAND.ogImage);
    expect(shareImage(null)).toEqual(BRAND.ogImage);
    expect(shareImage("/blog/cover.png")).toEqual({ url: "/blog/cover.png" });
    expect(shareImage("https://cdn.example/x.JPG?v=2")).toEqual({ url: "https://cdn.example/x.JPG?v=2" });
    expect(read("app/blog/[slug]/page.tsx")).toContain("shareImage(post.coverImage)");
  });
});
