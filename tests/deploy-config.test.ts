import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

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
 */
describe("Google Search Console verification", () => {
  const token = "google3cee98c985c30656";

  it("serves the verification file from the site root", () => {
    const file = readFileSync(
      new URL(`../public/${token}.html`, import.meta.url),
      "utf8"
    );
    // Google matches the body exactly, trailing whitespace included.
    expect(file).toBe(`google-site-verification: ${token}.html`);
  });

  it("is not hidden from crawlers", async () => {
    const robots = readFileSync(
      new URL("../app/robots.ts", import.meta.url),
      "utf8"
    );
    // The disallow list names paths; none of them may cover the site root file.
    expect(robots).not.toContain(token);
    expect(robots).toContain('allow: "/"');
  });
});
