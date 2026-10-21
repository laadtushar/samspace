import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { refreshRates } from "@/lib/fx-refresh";
import { log, newRef, errorFields } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Keeps the stored rates current.
 *
 * Run once a day by Vercel Cron, and on demand from the dashboard. It fetches
 * once and writes a rate for each currency an enabled country is quoted in —
 * nothing else, because a rate nobody can be shown is a row that only makes the
 * settings page harder to read.
 *
 * A country with no rate is quoted in rupees, so a failed run is not an
 * incident: the previous rates stand, and when they eventually go stale the
 * site falls back to the currency it bills in anyway.
 */

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  const ref = newRef();

  if (!authorised(req)) {
    log.warn("fx.rejected", { ref });
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!dbConfigured()) {
    log.error("fx.no_database", { ref });
    return NextResponse.json({ error: "No database configured", ref }, { status: 503 });
  }

  try {
    const result = await refreshRates(ref);
    return NextResponse.json({ ok: true, ref, ...result });
  } catch (error) {
    log.error("fx.failed", { ref, ...errorFields(error) });
    return NextResponse.json({ error: "Could not refresh rates", ref }, { status: 500 });
  }
}
