import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

/**
 * The cron schedule is the one piece of configuration that can stop a
 * deployment from existing at all.
 *
 * Hobby accounts are limited to daily cron jobs, and a schedule that would run
 * more often is refused when the deployment is created — before there is a
 * build to look at. The dashboard therefore shows nothing rather than a failure,
 * which is how an hourly schedule went unnoticed for three days while four
 * green commits sat on main undeployed. This is the guard that would have said
 * so immediately.
 */
const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
) as { crons?: { path: string; schedule: string }[] };

/** True when the expression can fire more than once in a day. */
function runsMoreThanDaily(schedule: string): boolean {
  const [minute, hour] = schedule.trim().split(/\s+/);
  // Anything but a single literal — *, */2, 1,31, 9-17 — means several runs.
  return !/^\d+$/.test(minute ?? "") || !/^\d+$/.test(hour ?? "");
}

describe("vercel.json", () => {
  it("declares the reminder cron", () => {
    expect(config.crons?.map((c) => c.path)).toContain("/api/cron/reminders");
  });

  it("schedules every cron at most once a day", () => {
    for (const cron of config.crons ?? []) {
      expect(
        runsMoreThanDaily(cron.schedule),
        `${cron.path} is scheduled "${cron.schedule}", which runs more than once a day and will be refused on a Hobby account`
      ).toBe(false);
    }
  });

  it("uses five cron fields", () => {
    for (const cron of config.crons ?? []) {
      expect(cron.schedule.trim().split(/\s+/)).toHaveLength(5);
    }
  });

  it("recognises the schedules that would be refused", () => {
    expect(runsMoreThanDaily("0 * * * *")).toBe(true);
    expect(runsMoreThanDaily("*/30 * * * *")).toBe(true);
    expect(runsMoreThanDaily("0 9,17 * * *")).toBe(true);
    expect(runsMoreThanDaily("0 9-17 * * *")).toBe(true);
    expect(runsMoreThanDaily("0 4 * * *")).toBe(false);
    expect(runsMoreThanDaily("30 3 * * 1")).toBe(false);
  });
});

/**
 * Search Console proves ownership by fetching one file from the site root.
 *
 * Delete it, rename it, or let a formatter add a newline to it and the property
 * comes unverified — quietly, and the first anyone knows is that the search data
 * has stopped. It is 53 bytes of text with no other purpose, which is exactly
 * the kind of file that gets tidied away.
 *
 * The token is read off the filename rather than written here. Partly because
 * that is the invariant Google actually checks — the body has to name the file
 * it is in — and partly because a second copy of a high-entropy string is a
 * second copy: a secret scanner flagged the literal, correctly by its own rules
 * and wrongly in substance, since a verification token is published on purpose.
 */
describe("Google Search Console verification", () => {
  const publicDir = new URL("../public/", import.meta.url);
  const files = readdirSync(publicDir).filter((name) =>
    /^google[a-z0-9]+\.html$/.test(name)
  );

  it("has exactly one verification file", () => {
    // Two would mean an old property's file was left behind; none means the
    // property is unverified and nothing says so.
    expect(files).toHaveLength(1);
  });

  it("serves a body naming the file it is in", () => {
    const [name] = files;
    const body = readFileSync(new URL(name, publicDir), "utf8");
    // Google matches this exactly, trailing whitespace included.
    expect(body).toBe(`google-site-verification: ${name}`);
  });

  it("is not hidden from crawlers", () => {
    const robots = readFileSync(
      new URL("../app/robots.ts", import.meta.url),
      "utf8"
    );
    // The disallow list names paths; none of them may cover the site root file.
    for (const name of files) expect(robots).not.toContain(name);
    expect(robots).toContain('allow: "/"');
  });
});

/**
 * A redirect whose destination is editable copy must not be frozen at build time.
 *
 * `/whatsapp` forwards to the handle stored in the dashboard. With `revalidate`
 * the target was baked into the build as a response header — and a build renders
 * before it can read stored content, so a fresh deployment sent people to the
 * contact-section fallback while a perfectly good handle sat in the dashboard,
 * for as long as the revalidate window. The content read is cached either way, so
 * resolving per request costs nothing at the meter.
 */
describe("the WhatsApp doorway", () => {
  const route = readFileSync(
    new URL("../app/whatsapp/route.ts", import.meta.url),
    "utf8"
  );

  it("resolves its target per request rather than at build time", () => {
    expect(route).toContain('export const dynamic = "force-dynamic"');
    expect(route).not.toMatch(/^export const revalidate/m);
  });

  it("reads the handle through the cache, so the meter does not move", () => {
    /*
      Dynamic rendering without a cache would mean a storage read on every
      visit. It reads through publicContent, which wraps the same hourly cached
      accessor and adds the shipped copy as a floor — so the meter is unchanged
      and an unreadable store sends people to the handle rather than to a page
      anchor.
    */
    expect(route).toContain("publicContent");
    expect(route).not.toMatch(/getCachedContent\(\)\s*\.catch/);
  });
});
