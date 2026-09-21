import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

/**
 * Where site content is stored.
 *
 * Postgres, and only Postgres. It used to live in the blob store, then in
 * Postgres with blob underneath as a fallback. Blob is gone: it was billed per
 * operation, deployments rather than visitors spent a month's allowance in a
 * fortnight, and going over pauses the store — which is how the site came to be
 * serving its shipped defaults to every visitor with no booking link.
 *
 * A second store that could fail independently was never buying reliability. It
 * bought two ways to answer the same question differently, and a state where
 * the copy that mattered was the one that could not be read.
 *
 * Skipped without TEST_DATABASE_URL so a fresh clone still passes; CI sets it,
 * and tests/practice.test.ts fails the build if it is missing there.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

/** A database that refuses every statement, as an unreachable one does. */
function mockDeadDb(configured = true) {
  const calls = { statements: 0 };
  vi.doMock("@/lib/db", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/db")>()),
    dbConfigured: () => configured,
    sql: () => {
      calls.statements += 1;
      throw new Error("database unreachable");
    },
  }));
  return calls;
}

afterEach(() => {
  vi.doUnmock("@/lib/db");
  vi.resetModules();
});

suite("site content in Postgres", () => {
  let sql: typeof import("@/lib/db").sql;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  // Restored so other files are not affected by the order they happen to run
  // in — every test file shares one process.
  afterAll(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    await sql()`delete from site_content`;
    vi.resetModules();
  });

  const row = async () =>
    (await sql()`select content, updated_at from site_content where id = 'site'`) as unknown as {
      content: Record<string, unknown>;
      updated_at: Date;
    }[];

  it("round-trips a save through the database", async () => {
    const { getContent, saveContent, defaultContent } = await import("@/lib/content");

    await saveContent({
      ...defaultContent,
      calendlyUrl: "https://cal.id/samvriti.space/therapy-session",
      hero: { ...defaultContent.hero, headline: "Written to Postgres" },
    });

    const read = await getContent();
    expect(read.hero.headline).toBe("Written to Postgres");
    expect(read.calendlyUrl).toBe("https://cal.id/samvriti.space/therapy-session");
  });

  it("serves the shipped defaults while nothing has been saved", async () => {
    /*
      An empty table is not an error. It is the state a fresh install is in, and
      the state this one is in while the content stranded in the old store
      cannot be copied across — so it has to render a working site, not a blank.
    */
    const { getContent, defaultContent } = await import("@/lib/content");
    const content = await getContent();

    expect(content.hero.headline).toBe(defaultContent.hero.headline);
    expect(content.calendlyUrl).toBe(defaultContent.calendlyUrl);
    expect(content.crisis.helplines.length).toBeGreaterThan(0);
  });

  it("keeps the defaults underneath a partially stored row", async () => {
    // mergeContent merges one level deep, which is what lets a deployment add a
    // field without the stored row having to know about it.
    await sql()`
      insert into site_content (id, content)
      values ('site', ${JSON.stringify({ hero: { headline: "Only a headline" } })}::jsonb)
    `;
    const { getContent, defaultContent } = await import("@/lib/content");
    const content = await getContent();

    expect(content.hero.headline).toBe("Only a headline");
    expect(content.hero.subtext).toBe(defaultContent.hero.subtext);
    expect(content.crisis.helplines.length).toBeGreaterThan(0);
  });

  it("overwrites the row rather than adding a second one", async () => {
    const { saveContent, defaultContent } = await import("@/lib/content");
    await saveContent({ ...defaultContent, hero: { ...defaultContent.hero, headline: "First" } });
    await saveContent({ ...defaultContent, hero: { ...defaultContent.hero, headline: "Second" } });

    const rows = await row();
    expect(rows.length).toBe(1);
    expect((rows[0].content.hero as { headline: string }).headline).toBe("Second");
  });

  it("moves updated_at forward on a save", async () => {
    const { saveContent, defaultContent } = await import("@/lib/content");
    await saveContent(defaultContent);
    const [before] = await row();
    await saveContent({ ...defaultContent, hero: { ...defaultContent.hero, headline: "Later" } });
    const [after] = await row();
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime()
    );
  });
});

describe("a database that cannot be read", () => {
  it("throws, so the caller decides rather than the storage layer", async () => {
    /*
      Nothing is caught down here. A visitor gets the shipped copy from
      publicContent; the dashboard is shown the error rather than an empty form
      it could save over the top of real content. Those are different answers to
      the same failure, and only the callers know which one applies.
    */
    vi.resetModules();
    mockDeadDb();

    const { getContent, publicContent, defaultContent } = await import("@/lib/content");
    await expect(getContent()).rejects.toThrow();

    const shown = await publicContent();
    expect(shown.hero.headline).toBe(defaultContent.hero.headline);
    expect(JSON.stringify(shown)).not.toContain("{{");
  });

  it("reads once rather than retrying into a store that is down", async () => {
    vi.resetModules();
    const db = mockDeadDb();

    const { getContent } = await import("@/lib/content");
    await expect(getContent()).rejects.toThrow();
    expect(db.statements).toBe(1);
  });
});

describe("no database configured", () => {
  it("serves the shipped defaults rather than failing", async () => {
    // A fresh clone with no DATABASE_URL still renders the site.
    vi.resetModules();
    mockDeadDb(false);

    const { getContent, defaultContent } = await import("@/lib/content");
    expect((await getContent()).hero.headline).toBe(defaultContent.hero.headline);
  });

  it("refuses to save rather than reporting a write that went nowhere", async () => {
    /*
      There is nowhere else to put it now. A save that succeeds silently would
      close the editor, look saved, and leave the site serving what it served
      before — which is worse than an error, because nobody goes looking.
    */
    vi.resetModules();
    mockDeadDb(false);

    const { saveContent, defaultContent } = await import("@/lib/content");
    await expect(saveContent(defaultContent)).rejects.toThrow(/DATABASE_URL/);
  });
});
