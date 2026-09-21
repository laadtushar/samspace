import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The upload endpoint's own decisions.
 *
 * It is directly reachable by anyone holding an admin session, so the file
 * input's `accept` attribute controls nothing: type and size are checked here
 * or not at all.
 */

const saveImage = vi.fn();
let databaseConfigured = true;
let admin: Response | null = null;

vi.mock("@/lib/admin-guard", () => ({ requireAdmin: async () => admin }));
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  dbConfigured: () => databaseConfigured,
}));
vi.mock("@/lib/images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images")>()),
  saveImage: (...a: unknown[]) => saveImage(...a),
}));

const { POST } = await import("@/app/api/admin/upload/route");

function upload(file: File | null) {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("https://example.test/api/admin/upload", {
    method: "POST",
    body: form,
  });
}

const png = (bytes = 8, type = "image/png") =>
  new File([new Uint8Array(bytes)], "cover.png", { type });

beforeEach(() => {
  saveImage.mockReset().mockResolvedValue(undefined);
  databaseConfigured = true;
  admin = null;
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/admin/upload", () => {
  it("stores the image and returns the path it will be served at", async () => {
    const res = await POST(upload(png()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^\/media\/cover-[0-9a-f]{8}\.png$/);
    expect(saveImage).toHaveBeenCalledTimes(1);
  });

  it("refuses anyone who is not an administrator, before reading the body", async () => {
    admin = new Response("no", { status: 401 });
    const res = await POST(upload(png()));

    expect(res.status).toBe(401);
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("refuses a type that is not an image", async () => {
    // The obvious one to try: an HTML file served from this origin.
    const file = new File(["<h1>hi</h1>"], "page.html", { type: "text/html" });
    const res = await POST(upload(file));

    expect(res.status).toBe(400);
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("refuses a file larger than the limit", async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    const res = await POST(upload(big));

    expect(res.status).toBe(400);
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("refuses a request with no file at all", async () => {
    const res = await POST(upload(null));
    expect(res.status).toBe(400);
  });

  it("refuses rather than accepting bytes it cannot store", async () => {
    /*
      Without a database there is nowhere for the bytes to go. Answering with a
      URL anyway would put a link that never resolves into a post that had
      already been saved.
    */
    databaseConfigured = false;
    const res = await POST(upload(png()));

    expect(res.status).toBe(503);
    expect(saveImage).not.toHaveBeenCalled();
  });

  it("reports a failed write instead of a URL", async () => {
    saveImage.mockRejectedValue(new Error("database unreachable"));
    const res = await POST(upload(png()));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.url).toBeUndefined();
    // A reference the person can quote when they say the upload failed.
    expect(body.ref).toBeTruthy();
  });

  it("stores the bytes it was given, under the type it was told", async () => {
    await POST(upload(png(4, "image/webp")));
    const [, bytes, contentType] = saveImage.mock.calls[0];

    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect((bytes as Buffer).byteLength).toBe(4);
    expect(contentType).toBe("image/webp");
  });
});
