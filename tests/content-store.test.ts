import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

/**
 * Where site content is stored, and what happens when a store is unavailable.
 *
 * Content used to live in blob alone. Blob is billed per operation, ten routes
 * read it, each read is a head plus a fetch, and the cache key is scoped to the
 * build — so deployments, not visitors, spent a monthly allowance in a
 * fortnight. Going over pauses the store, and content is the only copy of the
 * booking link and the WhatsApp handle: the shipped defaults carry neither.
 *
 * So the order matters, and none of it can be checked by reading the code. The
 * database suites are skipped without TEST_DATABASE_URL so a fresh clone still
 * passes; CI sets it, and tests/practice.test.ts fails the build if it is
 * missing there.
 */

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

/** Blob with the two content functions replaced, and a record of the calls. */
function mockBlob(over: {
  read?: () => unknown;
  write?: (key: string, value: unknown) => void;
}) {
  const calls = { reads: 0, writes: [] as { key: string; value: unknown }[] };
  vi.doMock("@/lib/blob", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/blob")>()),
    readPublicJson: async () => {
      calls.reads += 1;
      return over.read ? over.read() : null;
    },
    writePublicJson: async (key: string, value: unknown) => {
      calls.writes.push({ key, value });
      over.write?.(key, value);
    },
  }));
  return calls;
}

/** A database whose every statement fails, as a paused or unmigrated one does. */
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
  vi.doUnmock("@/lib/blob");
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

  // Restored so the blob-only suites in other files are not affected by the
  // order they happen to run in — every test file shares one process.
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

  it("round-trips a save through the database, not through blob", async () => {
    const blob = mockBlob({});
    const { getContent, saveContent, defaultContent } = await import("@/lib/content");

    await saveContent({
      ...defaultContent,
      calendlyUrl: "https://cal.id/samvriti.space/therapy-session",
      hero: { ...defaultContent.hero, headline: "Written to Postgres" },
    });

    expect(blob.writes).toEqual([]);
    const read = await getContent();
    expect(read.hero.headline).toBe("Written to Postgres");
    expect(read.calendlyUrl).toBe("https://cal.id/samvriti.space/therapy-session");
  });

  it("does not touch blob at all once the row exists", async () => {
    const first = mockBlob({});
    const { saveContent, defaultContent } = await import("@/lib/content");
    await saveContent({ ...defaultContent, hero: { ...defaultContent.hero, headline: "Stored" } });
    expect(first.reads).toBe(0);

    // A fresh module registry, so nothing is being served from a cache.
    vi.doUnmock("@/lib/blob");
    vi.resetModules();
    const second = mockBlob({
      read: () => {
        throw new Error("blob must not be read");
      },
    });
    const { getContent } = await import("@/lib/content");
    expect((await getContent()).hero.headline).toBe("Stored");
    expect(second.reads).toBe(0);
  });

  it("keeps the defaults underneath a partially stored row", async () => {
    // mergeContent merges one level deep, which is what lets a deployment add a
    // field without the stored row having to know about it.
    await sql()`
      insert into site_content (id, content)
      values ('site', ${JSON.stringify({ hero: { headline: "Only a headline" } })}::jsonb)
    `;
    mockBlob({});
    const { getContent, defaultContent } = await import("@/lib/content");
    const content = await getContent();

    expect(content.hero.headline).toBe("Only a headline");
    expect(content.hero.subtext).toBe(defaultContent.hero.subtext);
    expect(content.hero.quoteText).toBe(defaultContent.hero.quoteText);
    expect(content.crisis.helplines.length).toBeGreaterThan(0);
  });

  it("copies blob content into the empty table on the way past", async () => {
    const stored = { calendlyUrl: "https://cal.id/samvriti.space/therapy-session" };
    mockBlob({ read: () => stored });
    const { getContent } = await import("@/lib/content");

    const content = await getContent();
    expect(content.calendlyUrl).toBe("https://cal.id/samvriti.space/therapy-session");

    // The point of the backfill: the next save cannot overwrite real content
    // with the shipped defaults, because the row is already there to be read.
    const [saved] = await row();
    expect(saved).toBeTruthy();
    expect(saved.content.calendlyUrl).toBe("https://cal.id/samvriti.space/therapy-session");
  });

  it("serves what it read even if the copy across fails", async () => {
    mockBlob({ read: () => ({ hero: { headline: "From blob" } }) });
    vi.doMock("@/lib/db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/db")>();
      return {
        ...actual,
        // Reads fine, refuses to write — a read-only replica, or a table the
        // deployment's role cannot insert into.
        sql: () => {
          const real = actual.sql();
          const tagged = (async (...args: Parameters<typeof real>) => {
            const text = args[0].join("");
            if (/insert|update/i.test(text)) throw new Error("read only");
            return real(...args);
          }) as typeof real;
          tagged.query = real.query;
          return tagged;
        },
      };
    });

    const { getContent } = await import("@/lib/content");
    expect((await getContent()).hero.headline).toBe("From blob");
    expect(await row()).toEqual([]);
  });

  it("overwrites the row rather than adding a second one", async () => {
    mockBlob({});
    const { saveContent, defaultContent } = await import("@/lib/content");
    await saveContent({ ...defaultContent, hero: { ...defaultContent.hero, headline: "First" } });
    await saveContent({ ...defaultContent, hero: { ...defaultContent.hero, headline: "Second" } });

    const rows = await row();
    expect(rows.length).toBe(1);
    expect((rows[0].content.hero as { headline: string }).headline).toBe("Second");
  });

  it("moves updated_at forward on a save", async () => {
    mockBlob({});
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
  it("falls back to blob rather than to the shipped defaults", async () => {
    // The distinction that matters: blob still has the booking link and every
    // edited word, and the defaults have neither.
    mockDeadDb();
    mockBlob({ read: () => ({ calendlyUrl: "https://cal.id/samvriti.space/therapy-session" }) });

    const { getContent } = await import("@/lib/content");
    const content = await getContent();
    expect(content.calendlyUrl).toBe("https://cal.id/samvriti.space/therapy-session");
  });

  it("does not copy blob over a database it merely failed to read", async () => {
    /*
      The read failing does not mean the row is absent. The database may hold
      content newer than blob's, and writing blob's version in because one
      select timed out would delete an edit with nothing to show for it. Only a
      read that succeeded and found nothing triggers the copy.
    */
    const db = mockDeadDb();
    mockBlob({ read: () => ({ hero: { headline: "Stale" } }) });

    const { getContent } = await import("@/lib/content");
    await getContent();

    // One statement attempted — the select. No insert followed it.
    expect(db.statements).toBe(1);
  });

  it("throws when blob is unavailable too, so the fallback is visible", async () => {
    mockDeadDb();
    mockBlob({
      read: () => {
        throw new Error("store paused");
      },
    });

    const { getContent, publicContent, defaultContent } = await import("@/lib/content");
    await expect(getContent()).rejects.toThrow();

    // The dashboard sees the error rather than an empty form it could save over
    // the top of; a visitor sees the shipped copy, which is a genuine floor.
    const shown = await publicContent();
    expect(shown.hero.headline).toBe(defaultContent.hero.headline);
    expect(shown.crisis.helplines.length).toBeGreaterThan(0);
    expect(JSON.stringify(shown)).not.toContain("{{");
  });
});

describe("no database configured", () => {
  it("reads and writes blob, exactly as before", async () => {
    mockDeadDb(false);
    const blob = mockBlob({ read: () => ({ hero: { headline: "Blob only" } }) });

    const { getContent, saveContent, defaultContent } = await import("@/lib/content");
    expect((await getContent()).hero.headline).toBe("Blob only");

    await saveContent(defaultContent);
    expect(blob.writes.length).toBe(1);
    expect(blob.writes[0].key).toBe("site-content.json");
  });
});
