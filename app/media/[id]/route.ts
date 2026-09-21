import { readImage } from "@/lib/images";
import { log, errorFields } from "@/lib/log";

/**
 * Serves a stored blog image.
 *
 * Deliberately not under /api. next.config sets `Cache-Control: no-store` on
 * every /api path — correct for endpoints that read a client list, and exactly
 * wrong here: it would put a database read in front of every view of every
 * picture on every page.
 *
 * An id never names different bytes, because an upload always generates a new
 * one. That makes the response immutable in the strict sense, so it is cached
 * for a year and the database is asked once per image per edge location.
 */
export const dynamic = "force-dynamic";

const A_YEAR = 60 * 60 * 24 * 365;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let image;
  try {
    image = await readImage(params.id);
  } catch (error) {
    // A database that cannot be read is not a missing image, and saying "404"
    // would invite whoever is looking to conclude the picture was deleted.
    log.error("image.unreadable", { id: params.id, ...errorFields(error) });
    return new Response("Image temporarily unavailable", { status: 503 });
  }

  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": `public, max-age=${A_YEAR}, immutable`,
      // Browsers must not be talked into treating an upload as a document.
      "X-Content-Type-Options": "nosniff",
      // An SVG is a script host. Served from this origin it could read the
      // admin session, so it is framed off and stripped of everything active.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
