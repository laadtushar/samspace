import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import {
  RESERVED_SLUGS,
  pageSlugProblem,
  isUsablePageSlug,
  pageSchema,
  toConfirm,
  unconfirmedPlaceholders,
  PAGE_SLUG_MAX,
} from "@/lib/page-format";

/**
 * Where a standalone page may live.
 *
 * A page is served at /<slug>, beside every route the site already has, so the
 * list of names it cannot take has to keep up with the routes. Rather than
 * trust someone to remember, the first test reads app/ and public/ and fails
 * when either holds something the list does not.
 */

const root = path.join(import.meta.dirname, "..");

/** What a top-level entry would be addressed as, without its extension. */
const baseName = (entry: string) => entry.replace(/\.[^.]+$/, "");

describe("the reserved list keeps up with the site", () => {
  it("reserves every top-level route in app/", () => {
    const entries = readdirSync(path.join(root, "app"), { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      // Dynamic segments and route groups are not addresses; page.tsx and the
      // root layout's own files are not either.
      if (name.startsWith("[") || name.startsWith("(")) continue;
      if (entry.isDirectory()) {
        if (name === "fonts") continue; // a folder of font files, not a route
        expect(RESERVED_SLUGS.has(name), `app/${name}`).toBe(true);
        continue;
      }
      if (/^(page|layout|error|not-found|globals|loading|template)\./.test(name)) continue;
      // Metadata files (icon.svg, opengraph-image.png, sitemap.ts, robots.ts,
      // manifest.ts) each answer at a top-level address.
      if (/\.alt\.txt$/.test(name)) continue;
      expect(RESERVED_SLUGS.has(baseName(name)), `app/${name}`).toBe(true);
    }
  });

  it("reserves every file and folder in public/", () => {
    for (const name of readdirSync(path.join(root, "public"))) {
      expect(RESERVED_SLUGS.has(baseName(name)), `public/${name}`).toBe(true);
    }
  });

  it("reserves the routes the task named, and the ones that matter most", () => {
    for (const slug of [
      "admin",
      "api",
      "blog",
      "about",
      "start",
      "whatsapp",
      "media",
      "preview",
      "sitemap.xml",
      "robots.txt",
      "llms.txt",
      "_next",
      ".well-known",
    ]) {
      expect(RESERVED_SLUGS.has(slug), slug).toBe(true);
      expect(isUsablePageSlug(slug), slug).toBe(false);
    }
  });
});

describe("slug rules", () => {
  it("accepts an ordinary landing-page slug", () => {
    expect(pageSlugProblem("therapy-for-indians-abroad")).toBeNull();
    expect(pageSlugProblem("a")).toBeNull();
    expect(pageSlugProblem("2026-guide")).toBeNull();
  });

  it("refuses reserved names with a message that says why", () => {
    expect(pageSlugProblem("admin")).toMatch(/already a part of the site/);
    expect(pageSlugProblem("preview")).toMatch(/already a part of the site/);
  });

  it("refuses anything that is not lowercase words joined by single hyphens", () => {
    for (const bad of [
      "",
      "Admin",
      "UPPER",
      "with space",
      "trailing-",
      "-leading",
      "double--hyphen",
      "under_score",
      "dot.html",
      "slash/inside",
      "../admin",
      "%2e%2e",
      "émigré",
      "a".repeat(PAGE_SLUG_MAX + 1),
    ]) {
      expect(pageSlugProblem(bad), JSON.stringify(bad)).not.toBeNull();
    }
  });

  it("holds requests to the same rules through the schema", () => {
    const base = { title: "T", content: "Body", status: "draft" };
    expect(pageSchema.safeParse({ ...base, slug: "fine-slug" }).success).toBe(true);
    for (const slug of ["admin", "api", "sitemap", "Bad Slug", "", "a--b"]) {
      expect(pageSchema.safeParse({ ...base, slug }).success, slug).toBe(false);
    }
  });
});

describe("placeholders cannot be published", () => {
  const base = { slug: "a-page", title: "A page", seoTitle: "", seoDescription: "" };

  it("finds every placeholder, bold or not", () => {
    const text = `One ${toConfirm("fees")} and [To confirm: wording] and [not one]`;
    expect(unconfirmedPlaceholders(text)).toEqual([
      "[To confirm: fees]",
      "[To confirm: wording]",
    ]);
  });

  it("saves a draft that still has one", () => {
    const parsed = pageSchema.safeParse({
      ...base,
      content: `Body ${toConfirm("fees")}`,
      status: "draft",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses to publish while any field has one", () => {
    for (const field of ["content", "title", "seoTitle", "seoDescription"] as const) {
      const parsed = pageSchema.safeParse({
        ...base,
        content: "Body",
        [field]: `Text ${toConfirm("something")}`,
        status: "published",
      });
      expect(parsed.success, field).toBe(false);
      expect(parsed.error?.issues[0]?.message, field).toMatch(/To confirm/);
    }
  });

  it("publishes once they are gone", () => {
    expect(
      pageSchema.safeParse({ ...base, content: "Body", status: "published" }).success
    ).toBe(true);
  });
});
