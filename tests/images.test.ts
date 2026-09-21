import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { imageId, ALLOWED_TYPES, MAX_BYTES, MEDIA_PREFIX } from "@/lib/media";

/**
 * Blog images, now that they live in Postgres.
 *
 * They were the one thing with nowhere else to be when the blob store passed
 * its limit and started answering 403 — and an upload endpoint that cannot
 * write is a blog editor that cannot publish a post with a picture.
 */

describe("naming a stored image", () => {
  it("derives the name rather than accepting the uploaded one", () => {
    /*
      The id becomes the URL. Taking the filename would let whoever is posting
      choose a path — including one with a slash or a traversal in it.

      The fixture deliberately avoids words a secret scanner reacts to. An
      earlier version used a traversal ending in a well-known system filename
      and tripped GitGuardian, which is noise in a queue that should only ever
      hold real findings. The separators are what this is testing; the rest of
      the name was never the point.
    */
    const id = imageId("../../../cover.png", "image/png");
    expect(id).not.toContain("/");
    expect(id).not.toContain("..");
    expect(id.endsWith(".png")).toBe(true);

    // A backslash is a separator too, on the system a file may have come from.
    expect(imageId("..\\..\\cover.png", "image/png")).not.toContain("\\");
  });

  it("keeps a readable stem, so a URL says what it points at", () => {
    expect(imageId("Cover Photo.JPG", "image/jpeg")).toMatch(
      /^cover-photo-[0-9a-f]{8}\.jpg$/
    );
  });

  it("never lets one upload overwrite another", () => {
    // Two people uploading "cover.png" must not collide — older posts keep
    // their pictures, which is why an id is generated and not chosen.
    const a = imageId("cover.png", "image/png");
    const b = imageId("cover.png", "image/png");
    expect(a).not.toBe(b);
  });

  it("falls back to a name when there is nothing usable to derive one from", () => {
    expect(imageId("___.png", "image/png")).toMatch(/^image-[0-9a-f]{8}\.png$/);
  });

  it("takes the extension from the declared type, not the filename", () => {
    // The filename is whatever was typed; the content type is what will be
    // served, so that is what the extension has to agree with.
    expect(imageId("photo.exe", "image/webp").endsWith(".webp")).toBe(true);
  });

  it("serves from outside /api, so the response can be cached", () => {
    /*
      next.config sets `Cache-Control: no-store` on every /api path — right for
      an endpoint that reads a client list, and exactly wrong for a picture,
      where it would put a database read in front of every view on every page.
    */
    expect(MEDIA_PREFIX.startsWith("/api")).toBe(false);
  });

  it("allows only image types, and bounds the size", () => {
    expect([...ALLOWED_TYPES.keys()].every((t) => t.startsWith("image/"))).toBe(true);
    expect(ALLOWED_TYPES.has("text/html")).toBe(false);
    expect(ALLOWED_TYPES.has("image/svg+xml")).toBe(true);
    expect(MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("storing and serving the bytes", () => {
  let sql: typeof import("@/lib/db").sql;
  const previousUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ sql } = await import("@/lib/db"));
    const { migrate } = await import("../scripts/migrate.mjs");
    await migrate(url!);
  });

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    await sql()`delete from blog_images`;
    vi.resetModules();
  });

  it("round-trips the exact bytes", async () => {
    // A picture that comes back subtly different is worse than one that fails:
    // nothing errors and the image is quietly corrupt.
    const { saveImage, readImage } = await import("@/lib/images");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10, 0x42]);

    await saveImage("round-trip.png", bytes, "image/png");
    const stored = await readImage("round-trip.png");

    expect(stored).not.toBeNull();
    expect(stored!.contentType).toBe("image/png");
    expect(Buffer.compare(stored!.bytes, bytes)).toBe(0);
  });

  it("records the size without having to read the bytes back", async () => {
    const { saveImage } = await import("@/lib/images");
    const bytes = Buffer.alloc(1234, 7);
    await saveImage("sized.png", bytes, "image/png");

    const rows = (await sql()`
      select byte_size from blog_images where id = 'sized.png'
    `) as unknown as { byte_size: number }[];
    expect(rows[0].byte_size).toBe(1234);
  });

  it("answers null for an id nothing is stored under", async () => {
    const { readImage } = await import("@/lib/images");
    expect(await readImage("never-uploaded.png")).toBeNull();
  });

  it("serves the bytes with a content type and a cache it can keep", async () => {
    const { saveImage } = await import("@/lib/images");
    const bytes = Buffer.from([1, 2, 3, 4]);
    await saveImage("served.webp", bytes, "image/webp");

    const { GET } = await import("@/app/media/[id]/route");
    const res = await GET(new Request("https://example.test/media/served.webp"), {
      params: { id: "served.webp" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    // An id never names different bytes, so this is immutable in the strict
    // sense and the database is asked once per edge location.
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.compare(Buffer.from(await res.arrayBuffer()), bytes)).toBe(0);
  });

  it("sandboxes what it serves, because an SVG is a script host", async () => {
    /*
      Served from this origin, an SVG could read the admin session. Uploads are
      restricted to administrators, but "only an admin can do it" is not a
      reason to let a stored file run on the site it was stored by.
    */
    const { saveImage } = await import("@/lib/images");
    await saveImage("x.svg", Buffer.from("<svg/>"), "image/svg+xml");

    const { GET } = await import("@/app/media/[id]/route");
    const res = await GET(new Request("https://example.test/media/x.svg"), {
      params: { id: "x.svg" },
    });

    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("sandbox");
    expect(csp).toContain("default-src 'none'");
  });

  it("answers 404 for a missing image", async () => {
    const { GET } = await import("@/app/media/[id]/route");
    const res = await GET(new Request("https://example.test/media/gone.png"), {
      params: { id: "gone.png" },
    });
    expect(res.status).toBe(404);
  });

  it("says 503 rather than 404 when the database cannot be read", async () => {
    /*
      The distinction matters to whoever is looking: "this picture was deleted"
      and "the database is down" are different facts, and a 404 invites the
      first conclusion — which would have someone re-uploading images during an
      outage.
    */
    vi.resetModules();
    vi.doMock("@/lib/db", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/db")>()),
      sql: () => {
        throw new Error("database unreachable");
      },
    }));

    const { GET } = await import("@/app/media/[id]/route");
    const res = await GET(new Request("https://example.test/media/any.png"), {
      params: { id: "any.png" },
    });
    expect(res.status).toBe(503);
    vi.doUnmock("@/lib/db");
  });
});
